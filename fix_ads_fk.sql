-- ============================================================
-- FIX: seller_ads foreign key + RLS so ads work end-to-end
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- 1. Add FK from seller_ads.profile_id → profiles.id if missing
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'seller_ads_profile_id_fkey'
      and table_name      = 'seller_ads'
      and table_schema    = 'public'
  ) then
    alter table public.seller_ads
      add constraint seller_ads_profile_id_fkey
      foreign key (profile_id)
      references public.profiles(id)
      on delete cascade;
  end if;
end;
$$;

-- 2. Drop old SELECT policies (may have trailing dots or wrong names)
drop policy if exists "Active ads are viewable by everyone."  on public.seller_ads;
drop policy if exists "Active ads are viewable by everyone"   on public.seller_ads;
drop policy if exists "Sellers can view all their own ads."   on public.seller_ads;
drop policy if exists "Sellers can view all their own ads"    on public.seller_ads;

-- 3. Recreate clean SELECT policies
-- Public: anyone can see active ads (landing page carousel)
create policy "Active ads are viewable by everyone"
  on public.seller_ads for select
  using (is_active = true);

-- Sellers: can see ALL their own ads including inactive (dashboard)
create policy "Sellers can view all their own ads"
  on public.seller_ads for select
  using (auth.uid() = profile_id);

-- 4. Reload PostgREST schema cache
notify pgrst, 'reload schema';
