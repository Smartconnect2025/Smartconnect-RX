-- ================================================
-- RLS Helper Functions for Healthcare Application
-- ================================================
-- This migration creates security definer functions used by RLS policies
-- across all tables. These functions bypass RLS to prevent infinite recursion.

-- Function: Check if current user is a provider
CREATE OR REPLACE FUNCTION public.is_provider()
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
    WHERE user_id = auth.uid()
    AND role = 'provider'
  );
END;
$$;

-- Function: Check if provider has access to a specific patient
-- Returns true if the current user is a provider assigned to the given patient
CREATE OR REPLACE FUNCTION public.provider_has_patient_access(p_patient_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.provider_patient_mappings ppm
    JOIN public.providers p ON p.id = ppm.provider_id
    WHERE ppm.patient_id = p_patient_id
    AND p.user_id = auth.uid()
  );
END;
$$;

-- Function: Check if current user is a pharmacy admin for a specific pharmacy
CREATE OR REPLACE FUNCTION public.is_pharmacy_admin(p_pharmacy_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.pharmacy_admins
    WHERE user_id = auth.uid()
    AND pharmacy_id = p_pharmacy_id
  );
END;
$$;

-- Function: Check if patient record belongs to current user
-- Used for tables that have patient_id instead of user_id
CREATE OR REPLACE FUNCTION public.is_own_patient_record(p_patient_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.patients
    WHERE id = p_patient_id
    AND user_id = auth.uid()
  );
END;
$$;

-- Function: Check if provider record belongs to current user
CREATE OR REPLACE FUNCTION public.is_own_provider_record(p_provider_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1
    FROM public.providers
    WHERE id = p_provider_id
    AND user_id = auth.uid()
  );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.is_provider() TO authenticated;
GRANT EXECUTE ON FUNCTION public.provider_has_patient_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pharmacy_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_own_patient_record(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_own_provider_record(uuid) TO authenticated;
