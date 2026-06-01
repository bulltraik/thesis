-- ============================================================
-- FIX: Add missing foreign key so PostgREST can join
-- products → profiles, then reload the schema cache.
-- Run this in the Supabase SQL Editor.
-- ============================================================

-- 1. Add the FK constraint if it doesn't already exist
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where constraint_name = 'products_profile_id_fkey'
      and table_name = 'products'
      and table_schema = 'public'
  ) then
    alter table public.products
      add constraint products_profile_id_fkey
      foreign key (profile_id)
      references public.profiles(id)
      on delete cascade;
  end if;
end;
$$;

-- 2. Force PostgREST to reload its schema cache immediately
-- (no restart needed)
notify pgrst, 'reload schema';
