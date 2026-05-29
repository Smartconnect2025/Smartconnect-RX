-- ========================================
-- COMPLETE RLS FIX FOR PATIENTS TABLE
-- ========================================
-- This script will fix the RLS policy issue for patient creation
-- Copy this entire file and run it in Supabase SQL Editor
-- ========================================

-- Step 1: Enable RLS on patients table
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Step 2: Drop all existing policies to start fresh
DROP POLICY IF EXISTS "Providers can insert patients" ON patients;
DROP POLICY IF EXISTS "Providers can create patients" ON patients;
DROP POLICY IF EXISTS "Allow providers to insert patients" ON patients;
DROP POLICY IF EXISTS "Providers can view their patients" ON patients;
DROP POLICY IF EXISTS "Providers can select their patients" ON patients;
DROP POLICY IF EXISTS "Providers can update their patients" ON patients;
DROP POLICY IF EXISTS "Providers can delete their patients" ON patients;

-- Step 3: Create INSERT policy for providers
-- This allows providers to create patients where provider_id matches their provider record
CREATE POLICY "Providers can insert patients"
ON patients
FOR INSERT
TO authenticated
WITH CHECK (
  provider_id IN (
    SELECT id FROM providers WHERE user_id = auth.uid()
  )
);

-- Step 4: Create SELECT policy for providers
-- This allows providers to view their own patients
CREATE POLICY "Providers can view their patients"
ON patients
FOR SELECT
TO authenticated
USING (
  provider_id IN (
    SELECT id FROM providers WHERE user_id = auth.uid()
  )
);

-- Step 5: Create UPDATE policy for providers
-- This allows providers to update their own patients
CREATE POLICY "Providers can update their patients"
ON patients
FOR UPDATE
TO authenticated
USING (
  provider_id IN (
    SELECT id FROM providers WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  provider_id IN (
    SELECT id FROM providers WHERE user_id = auth.uid()
  )
);

-- Step 6: Create DELETE policy for providers (optional, but good to have)
CREATE POLICY "Providers can delete their patients"
ON patients
FOR DELETE
TO authenticated
USING (
  provider_id IN (
    SELECT id FROM providers WHERE user_id = auth.uid()
  )
);

-- Step 7: Verify all policies were created successfully
SELECT
  schemaname,
  tablename,
  policyname,
  cmd as operation,
  permissive,
  roles
FROM pg_policies
WHERE tablename = 'patients'
ORDER BY cmd, policyname;

-- Step 8: Check if RLS is enabled
SELECT
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE tablename = 'patients';

-- ========================================
-- EXPECTED OUTPUT:
-- You should see 4 policies created:
-- 1. "Providers can insert patients" - INSERT
-- 2. "Providers can view their patients" - SELECT
-- 3. "Providers can update their patients" - UPDATE
-- 4. "Providers can delete their patients" - DELETE
-- And RLS Enabled = true
-- ========================================
