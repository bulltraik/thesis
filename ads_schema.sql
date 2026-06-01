-- Create seller_ads table
create table public.seller_ads (
  id uuid default gen_random_uuid() primary key,
  profile_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  description text,
  product_ids uuid[] default '{}',
  image_url text,
  is_active boolean default true,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Set up Row Level Security (RLS)
alter table public.seller_ads enable row level security;

-- Create policies
-- Everyone can view active ads
create policy "Active ads are viewable by everyone." on public.seller_ads
  for select using (is_active = true);

-- Sellers can view all their own ads (including inactive)
create policy "Sellers can view all their own ads." on public.seller_ads
  for select using (auth.uid() = profile_id);

-- Sellers can insert their own ads
create policy "Sellers can insert their own ads." on public.seller_ads
  for insert with check (auth.uid() = profile_id);

-- Sellers can update their own ads
create policy "Sellers can update their own ads." on public.seller_ads
  for update using (auth.uid() = profile_id);

-- Sellers can delete their own ads
create policy "Sellers can delete their own ads." on public.seller_ads
  for delete using (auth.uid() = profile_id);
