-- ============================================================
-- CART TABLE
-- Stores items a buyer has added to their cart.
-- Run this in the Supabase SQL Editor.
-- ============================================================

create table public.cart_items (
  id          uuid        primary key default gen_random_uuid(),
  buyer_id    uuid        not null references auth.users(id)      on delete cascade,
  product_id  uuid        not null references public.products(id) on delete cascade,
  quantity    integer     not null default 1 check (quantity > 0),
  added_at    timestamptz not null default now(),

  -- One row per buyer+product combination
  unique (buyer_id, product_id)
);

-- ── Row Level Security ──────────────────────────────────────
alter table public.cart_items enable row level security;

-- Buyers can only see their own cart
create policy "Buyers can view their own cart"
  on public.cart_items for select
  using (auth.uid() = buyer_id);

-- Buyers can add items to their own cart
create policy "Buyers can add to their cart"
  on public.cart_items for insert
  with check (auth.uid() = buyer_id);

-- Buyers can update quantity of their own cart items
create policy "Buyers can update their cart"
  on public.cart_items for update
  using (auth.uid() = buyer_id)
  with check (auth.uid() = buyer_id);

-- Buyers can remove items from their own cart
create policy "Buyers can delete from their cart"
  on public.cart_items for delete
  using (auth.uid() = buyer_id);

-- ── Index ────────────────────────────────────────────────────
create index cart_items_buyer_id_idx on public.cart_items(buyer_id);
