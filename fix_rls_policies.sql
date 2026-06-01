-- ============================================================
-- FIX: RLS policies so products & profiles are publicly readable
-- Run this in the Supabase SQL Editor.
-- Safe to run multiple times.
-- ============================================================

-- ── PRODUCTS ───────────────────────────────────────────────

-- Drop any existing SELECT policies on products (old or new name)
drop policy if exists "Products are viewable by everyone."  on public.products;
drop policy if exists "Products are viewable by everyone"   on public.products;

-- Recreate: anyone (including anonymous visitors) can read products
create policy "Products are viewable by everyone"
  on public.products
  for select
  using (true);


-- ── PROFILES ───────────────────────────────────────────────
-- The products query joins profiles, so profiles must also be
-- readable by everyone (needed for business_name, logo_url).

drop policy if exists "Public profiles are viewable by everyone." on public.profiles;
drop policy if exists "Profiles are publicly readable"            on public.profiles;

create policy "Profiles are publicly readable"
  on public.profiles
  for select
  using (true);


-- ── SELLER ADS ─────────────────────────────────────────────
-- Active ads are shown on the landing page to all visitors.

drop policy if exists "Active ads are viewable by everyone." on public.seller_ads;
drop policy if exists "Active ads are viewable by everyone"  on public.seller_ads;

create policy "Active ads are viewable by everyone"
  on public.seller_ads
  for select
  using (is_active = true);

-- Sellers can also see their own inactive ads in the dashboard
drop policy if exists "Sellers can view all their own ads." on public.seller_ads;
drop policy if exists "Sellers can view all their own ads"  on public.seller_ads;

create policy "Sellers can view all their own ads"
  on public.seller_ads
  for select
  using (auth.uid() = profile_id);
