-- ============================================================
-- PRODUCTS SCHEMA
-- Run this in the Supabase SQL Editor.
-- If re-creating from scratch, run the Teardown block first.
-- ============================================================


-- ============================================================
-- TEARDOWN (run first if re-creating)
-- ============================================================

drop table if exists public.products cascade;


-- ============================================================
-- SETUP
-- ============================================================

create table public.products (
  id          uuid        primary key default gen_random_uuid(),
  profile_id  uuid        not null references public.profiles(id) on delete cascade,
  name        text        not null,
  description text,
  price       numeric(10,2) not null,
  stock       integer     not null default 0,
  image_url   text,                        -- public URL of the uploaded image
  image_path  text,                        -- storage path used for deletion/replacement
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────────
alter table public.products enable row level security;

create policy "Products are viewable by everyone"
  on public.products for select using (true);

create policy "Sellers can insert their own products"
  on public.products for insert
  with check (auth.uid() = profile_id);

create policy "Sellers can update their own products"
  on public.products for update
  using (auth.uid() = profile_id)
  with check (auth.uid() = profile_id);

create policy "Sellers can delete their own products"
  on public.products for delete
  using (auth.uid() = profile_id);

-- ── Auto-update updated_at ──────────────────────────────────
-- Reuses the set_updated_at() function created in supabase_schema.sql.
-- If that function does not exist yet, create it first:
--
--   create or replace function public.set_updated_at()
--   returns trigger language plpgsql as $$
--   begin new.updated_at = now(); return new; end; $$;

create trigger products_set_updated_at
  before update on public.products
  for each row execute procedure public.set_updated_at();


-- ============================================================
-- MIGRATION — add image_path to an existing products table
-- Run ONLY if you already have a products table and just need
-- the new column (skip if you ran the full SETUP above).
-- ============================================================

-- alter table public.products add column if not exists image_path text;
-- alter table public.products add column if not exists updated_at timestamptz not null default now();
