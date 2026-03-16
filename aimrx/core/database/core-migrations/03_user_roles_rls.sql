-- User Roles RLS Policies
-- This migration sets up Row Level Security for the user_roles table

-- Create security definer function to check admin status
-- This function bypasses RLS to prevent infinite recursion
CREATE OR REPLACE FUNCTION public.is_admin(check_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = check_user_id
    AND role = 'admin'
  );
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.is_admin(uuid) TO authenticated;

-- Enable RLS on user_roles table
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Grant table permissions to authenticated users (RLS will control actual access)
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.user_roles TO authenticated;

-- Policy: Users can read their own role
DROP POLICY IF EXISTS "Users can read own role" ON public.user_roles;
CREATE POLICY "Users can read own role"
ON public.user_roles
FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

-- Policy: Admin users have full access to all user roles
DROP POLICY IF EXISTS "Admin users have full access" ON public.user_roles;
CREATE POLICY "Admin users have full access"
ON public.user_roles
FOR ALL
TO authenticated
USING (public.is_admin(auth.uid()))
WITH CHECK (public.is_admin(auth.uid()));