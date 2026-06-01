-- ============================================================
-- STORAGE BUCKETS + POLICIES
-- Run this in the Supabase SQL Editor.
-- Creates the 'logos' and 'product-images' buckets and sets
-- up RLS policies so authenticated sellers can upload files
-- and everyone can read them publicly.
-- ============================================================


-- ============================================================
-- 1. CREATE BUCKETS
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'logos',
    'logos',
    true,                          -- public: anyone can read via public URL
    2097152,                       -- 2 MB limit
    array['image/png', 'image/jpeg', 'image/webp']
  )
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  (
    'product-images',
    'product-images',
    true,                          -- public: anyone can read via public URL
    5242880,                       -- 5 MB limit
    array['image/png', 'image/jpeg', 'image/webp']
  )
on conflict (id) do update set
  public             = excluded.public,
  file_size_limit    = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;


-- ============================================================
-- 2. STORAGE POLICIES — logos bucket
-- ============================================================

-- Anyone can view/download logo files (needed for public shop pages)
create policy "Logos are publicly readable"
  on storage.objects for select
  using ( bucket_id = 'logos' );

-- Authenticated users can upload to their own folder (userId/...)
create policy "Users can upload their own logo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can replace/update their own logo
create policy "Users can update their own logo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own logo
create policy "Users can delete their own logo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'logos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );


-- ============================================================
-- 3. STORAGE POLICIES — product-images bucket
-- ============================================================

-- Anyone can view/download product images
create policy "Product images are publicly readable"
  on storage.objects for select
  using ( bucket_id = 'product-images' );

-- Authenticated users can upload to their own folder
create policy "Users can upload their own product images"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can update their own product images
create policy "Users can update their own product images"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Authenticated users can delete their own product images
create policy "Users can delete their own product images"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'product-images'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
