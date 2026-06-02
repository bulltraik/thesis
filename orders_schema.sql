-- ============================================================
-- ORDERS TABLE
-- Tracks purchases made by buyers from sellers.
-- Run this in the Supabase SQL Editor.
-- ============================================================

create table public.orders (
  id            uuid        primary key default gen_random_uuid(),
  buyer_id      uuid        not null references auth.users(id)    on delete cascade,
  product_id    uuid        not null references public.products(id) on delete cascade,
  seller_id     uuid        not null references public.profiles(id) on delete cascade,
  quantity      integer     not null default 1 check (quantity > 0),
  unit_price    numeric(10,2) not null,          -- price at time of purchase
  total_price   numeric(10,2) generated always as (quantity * unit_price) stored,
  status        text        not null default 'pending'
                            check (status in ('pending', 'confirmed', 'shipped', 'delivered', 'cancelled')),
  note          text,                            -- optional message from buyer
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────────
alter table public.orders enable row level security;

-- Buyers can see their own orders
create policy "Buyers can view their own orders"
  on public.orders for select
  using (auth.uid() = buyer_id);

-- Sellers can see orders placed for their products
create policy "Sellers can view orders for their products"
  on public.orders for select
  using (auth.uid() = seller_id);

-- Only authenticated buyers can place orders
create policy "Buyers can place orders"
  on public.orders for insert
  with check (auth.uid() = buyer_id);

-- Sellers can update order status (confirm, ship, deliver, cancel)
create policy "Sellers can update order status"
  on public.orders for update
  using (auth.uid() = seller_id)
  with check (auth.uid() = seller_id);

-- Buyers can cancel their own pending orders
create policy "Buyers can cancel their own pending orders"
  on public.orders for update
  using (auth.uid() = buyer_id and status = 'pending')
  with check (auth.uid() = buyer_id);

-- ── Auto-update updated_at ──────────────────────────────────
create trigger orders_set_updated_at
  before update on public.orders
  for each row execute procedure public.set_updated_at();

-- ── Index for fast lookups ──────────────────────────────────
create index orders_buyer_id_idx  on public.orders(buyer_id);
create index orders_seller_id_idx on public.orders(seller_id);
create index orders_product_id_idx on public.orders(product_id);
