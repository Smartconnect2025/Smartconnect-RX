-- ========================================
-- FIX PATIENTS TABLE RLS POLICY
-- ========================================
-- This script adds an INSERT policy for providers to create patients
-- ========================================

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Providers can insert patients" ON patients;
DROP POLICY IF EXISTS "Providers can create patients" ON patients;

-- Create new INSERT policy for providers
CREATE POLICY "Providers can insert patients"
ON patients
FOR INSERT
TO authenticated
WITH CHECK (
  provider_id IN (
    SELECT id FROM providers WHERE user_id = auth.uid()
  )
);

-- Verify the policy was created
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'patients' AND cmd = 'INSERT';
