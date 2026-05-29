-- ========================================
-- ENABLE RLS AND ADD POLICIES FOR PATIENTS TABLE
-- ========================================
-- This script enables RLS and adds necessary policies for patient creation
-- Run this in your Supabase SQL Editor
-- ========================================

-- Enable RLS on patients table if not already enabled
ALTER TABLE patients ENABLE ROW LEVEL SECURITY;

-- Drop existing INSERT policies if they exist
DROP POLICY IF EXISTS "Providers can insert patients" ON patients;
DROP POLICY IF EXISTS "Providers can create patients" ON patients;
DROP POLICY IF EXISTS "Allow providers to insert patients" ON patients;

-- Create INSERT policy: Providers can insert patients where provider_id matches their provider record
CREATE POLICY "Providers can insert patients"
ON patients
FOR INSERT
TO authenticated
WITH CHECK (
  provider_id IN (
    SELECT id FROM providers WHERE user_id = auth.uid()
  )
);

-- Drop existing SELECT policies if they exist (for comprehensive access)
DROP POLICY IF EXISTS "Providers can view their patients" ON patients;
DROP POLICY IF EXISTS "Providers can select their patients" ON patients;

-- Create SELECT policy: Providers can view their own patients
CREATE POLICY "Providers can view their patients"
ON patients
FOR SELECT
TO authenticated
USING (
  provider_id IN (
    SELECT id FROM providers WHERE user_id = auth.uid()
  )
);

-- Drop existing UPDATE policies if they exist
DROP POLICY IF EXISTS "Providers can update their patients" ON patients;

-- Create UPDATE policy: Providers can update their own patients
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

-- Verify all policies were created
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE tablename = 'patients'
ORDER BY cmd, policyname;

-- Check if RLS is enabled
SELECT schemaname, tablename, rowsecurity
FROM pg_tables
WHERE tablename = 'patients';
