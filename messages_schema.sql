-- ============================================================
-- MESSAGES TABLE
-- Direct messaging between buyers and sellers.
-- A conversation is identified by the pair (sender_id, recipient_id)
-- scoped to a product. Messages are sent when a buyer places an
-- order (system message) or manually from either party.
-- Run this in the Supabase SQL Editor.
-- ============================================================

create table public.messages (
  id            uuid        primary key default gen_random_uuid(),
  sender_id     uuid        not null references auth.users(id)     on delete cascade,
  recipient_id  uuid        not null references auth.users(id)     on delete cascade,
  product_id    uuid        references public.products(id)         on delete set null,
  body          text        not null check (char_length(body) > 0 and char_length(body) <= 2000),
  is_system     boolean     not null default false,   -- true = auto-sent on order
  is_read       boolean     not null default false,
  created_at    timestamptz not null default now()
);

-- ── Row Level Security ──────────────────────────────────────
alter table public.messages enable row level security;

-- Sender can see messages they sent
create policy "Users can view messages they sent"
  on public.messages for select
  using (auth.uid() = sender_id);

-- Recipient can see messages sent to them
create policy "Users can view messages sent to them"
  on public.messages for select
  using (auth.uid() = recipient_id);

-- Authenticated users can send messages
create policy "Authenticated users can send messages"
  on public.messages for insert
  with check (auth.uid() = sender_id);

-- Recipient can mark their messages as read
create policy "Recipients can mark messages as read"
  on public.messages for update
  using (auth.uid() = recipient_id)
  with check (auth.uid() = recipient_id);

-- Sender can delete their own messages
create policy "Senders can delete their own messages"
  on public.messages for delete
  using (auth.uid() = sender_id);

-- ── Indexes ─────────────────────────────────────────────────
-- Fast lookup of all messages in a conversation
create index messages_sender_idx     on public.messages(sender_id);
create index messages_recipient_idx  on public.messages(recipient_id);
create index messages_product_idx    on public.messages(product_id);
-- Unread count lookup
create index messages_unread_idx     on public.messages(recipient_id, is_read)
  where is_read = false;
