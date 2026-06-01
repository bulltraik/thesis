-- ============================================================
-- PROFILES SCHEMA
-- Run this in the Supabase SQL Editor.
-- If you had a broken profiles table before, run the
-- "Teardown" block first, then run the "Setup" block.
-- ============================================================


-- ============================================================
-- TEARDOWN (run this first if re-creating from scratch)
-- Drops the old trigger, function, and table cleanly.
-- ============================================================

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();
drop table if exists public.profiles cascade;
-- NOTE: `cascade` will also drop products and seller_ads if they
-- reference profiles. Re-run products_schema.sql and ads_schema.sql
-- after this if you need to recreate those tables too.


-- ============================================================
-- SETUP
-- ============================================================

-- 1. Create the profiles table
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  role          text not null default 'buyer' check (role in ('buyer', 'seller')),
  business_name text,
  description   text,
  logo_url      text,
  contact_email text,
  address       text,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- 2. Enable Row Level Security
alter table public.profiles enable row level security;

-- 3. RLS Policies

-- Anyone can read any profile (needed for shop/marketplace pages)
create policy "Profiles are publicly readable"
  on public.profiles
  for select
  using (true);

-- A user can only insert their own profile row
create policy "Users can insert their own profile"
  on public.profiles
  for insert
  with check (auth.uid() = id);

-- A user can only update their own profile row
create policy "Users can update their own profile"
  on public.profiles
  for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- A user can delete their own profile row
create policy "Users can delete their own profile"
  on public.profiles
  for delete
  using (auth.uid() = id);

-- 4. Auto-update `updated_at` on every row change
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row
  execute procedure public.set_updated_at();

-- 5. Auto-create a profile row when a new user signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, contact_email, address, role)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'address',
    coalesce(new.raw_user_meta_data->>'role', 'buyer')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute procedure public.handle_new_user();

-- ============================================================
-- MIGRATION — add role to an existing profiles table
-- Run this block in the Supabase SQL Editor if you already
-- have a profiles table and just need the new column.
-- Safe to run multiple times (uses IF NOT EXISTS).
-- ============================================================

-- Step 1: Add the column with a default so existing rows get 'buyer'
alter table public.profiles
  add column if not exists role text not null default 'buyer';

-- Step 2: Add the check constraint so only valid values are accepted
--         (skip if the constraint already exists)
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'profiles_role_check'
      and conrelid = 'public.profiles'::regclass
  ) then
    alter table public.profiles
      add constraint profiles_role_check check (role in ('buyer', 'seller'));
  end if;
end;
$$;

-- Step 3: Backfill any existing rows that may have a null role
--         (shouldn't happen with the default, but just in case)
update public.profiles
  set role = 'buyer'
  where role is null;
