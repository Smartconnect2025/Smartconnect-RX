-- Create All Supabase Storage Buckets and Policies
-- This migration consolidates all storage bucket creation for the application

-- ==============================================
-- 1. AVATARS BUCKET
-- ==============================================

-- Create the avatars storage bucket for user profile pictures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'avatars',
  'avatars',
  true,
  5242880, -- 5MB limit
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Policy: Users can view all avatars (public bucket)
DROP POLICY IF EXISTS "Public avatars are viewable by everyone" ON storage.objects;
CREATE POLICY "Public avatars are viewable by everyone" ON storage.objects
FOR SELECT USING (bucket_id = 'avatars');

-- Policy: Users can upload their own avatars
DROP POLICY IF EXISTS "Users can upload their own avatars" ON storage.objects;
CREATE POLICY "Users can upload their own avatars" ON storage.objects
FOR INSERT WITH CHECK (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Policy: Users can update their own avatars
DROP POLICY IF EXISTS "Users can update their own avatars" ON storage.objects;
CREATE POLICY "Users can update their own avatars" ON storage.objects
FOR UPDATE USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- Policy: Users can delete their own avatars
DROP POLICY IF EXISTS "Users can delete their own avatars" ON storage.objects;
CREATE POLICY "Users can delete their own avatars" ON storage.objects
FOR DELETE USING (
  bucket_id = 'avatars'
  AND auth.uid()::text = (storage.foldername(name))[2]
);

-- ==============================================
-- 2. RESOURCES BUCKET
-- ==============================================

-- Create bucket for educational resources and content
INSERT INTO storage.buckets (id, name, public)
VALUES ('resources', 'resources', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy for resources bucket
DROP POLICY IF EXISTS "Public read access for resources" ON storage.objects;
CREATE POLICY "Public read access for resources"
ON storage.objects FOR SELECT
USING ( bucket_id = 'resources' );

-- Authenticated users can insert into resources bucket
DROP POLICY IF EXISTS "Authenticated upload to resources" ON storage.objects;
CREATE POLICY "Authenticated upload to resources"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'resources' );

-- Authenticated users can update their own objects in resources bucket
DROP POLICY IF EXISTS "Authenticated update own resources" ON storage.objects;
CREATE POLICY "Authenticated update own resources"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'resources' AND (auth.uid() = owner) )
WITH CHECK ( bucket_id = 'resources' AND (auth.uid() = owner) );

-- Authenticated users can delete their own objects in resources bucket
DROP POLICY IF EXISTS "Authenticated delete own resources" ON storage.objects;
CREATE POLICY "Authenticated delete own resources"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'resources' AND (auth.uid() = owner) );

-- ==============================================
-- 3. PRODUCTS BUCKET
-- ==============================================

-- Create bucket for product images
INSERT INTO storage.buckets (id, name, public)
VALUES ('products', 'products', true)
ON CONFLICT (id) DO NOTHING;

-- Public read policy for products bucket
DROP POLICY IF EXISTS "Public read access for products" ON storage.objects;
CREATE POLICY "Public read access for products"
ON storage.objects FOR SELECT
USING ( bucket_id = 'products' );

-- Authenticated users can insert into products bucket
DROP POLICY IF EXISTS "Authenticated upload to products" ON storage.objects;
CREATE POLICY "Authenticated upload to products"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK ( bucket_id = 'products' );

-- Authenticated users can update their own objects in products bucket
DROP POLICY IF EXISTS "Authenticated update own products" ON storage.objects;
CREATE POLICY "Authenticated update own products"
ON storage.objects FOR UPDATE
TO authenticated
USING ( bucket_id = 'products' AND (auth.uid() = owner) )
WITH CHECK ( bucket_id = 'products' AND (auth.uid() = owner) );

-- Authenticated users can delete their own objects in products bucket
DROP POLICY IF EXISTS "Authenticated delete own products" ON storage.objects;
CREATE POLICY "Authenticated delete own products"
ON storage.objects FOR DELETE
TO authenticated
USING ( bucket_id = 'products' AND (auth.uid() = owner) );

-- Admin users can manage all objects in products bucket
DROP POLICY IF EXISTS "Admin full access to products" ON storage.objects;
CREATE POLICY "Admin full access to products"
ON storage.objects FOR ALL
TO authenticated
USING ( bucket_id = 'products' AND (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
))
WITH CHECK ( bucket_id = 'products' AND (
  EXISTS (
    SELECT 1 FROM user_roles ur
    WHERE ur.user_id = auth.uid()
    AND ur.role = 'admin'
  )
));