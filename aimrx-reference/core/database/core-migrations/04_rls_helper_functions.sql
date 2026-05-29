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

-- Function: Sync patient mappings for all clinic members when a patient is created
CREATE OR REPLACE FUNCTION public.sync_group_patient_mappings_for_patient(
  p_patient_id uuid,
  p_creator_provider_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  SELECT group_id INTO v_group_id
  FROM public.providers
  WHERE id = p_creator_provider_id;

  IF v_group_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.provider_patient_mappings (provider_id, patient_id)
  SELECT p.id, p_patient_id
  FROM public.providers p
  WHERE p.group_id = v_group_id
    AND p.id != p_creator_provider_id
    AND p.is_active = true
  ON CONFLICT (provider_id, patient_id) DO NOTHING;
END;
$$;

-- Function: Sync a provider to all existing patients in their clinic
CREATE OR REPLACE FUNCTION public.sync_provider_to_group_patients(
  p_provider_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id uuid;
BEGIN
  SELECT group_id INTO v_group_id
  FROM public.providers
  WHERE id = p_provider_id;

  IF v_group_id IS NULL THEN
    RETURN;
  END IF;

  INSERT INTO public.provider_patient_mappings (provider_id, patient_id)
  SELECT p_provider_id, ppm.patient_id
  FROM public.provider_patient_mappings ppm
  JOIN public.providers p ON p.id = ppm.provider_id
  WHERE p.group_id = v_group_id
    AND p.id != p_provider_id
  ON CONFLICT (provider_id, patient_id) DO NOTHING;
END;
$$;

-- Function: Remove all patient mappings for a provider EXCEPT patients they created
CREATE OR REPLACE FUNCTION public.remove_non_owned_patient_mappings(
  p_provider_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.provider_patient_mappings ppm
  WHERE ppm.provider_id = p_provider_id
    AND ppm.patient_id NOT IN (
      SELECT pat.id FROM public.patients pat
      WHERE pat.provider_id = p_provider_id
    );
END;
$$;

-- Grant execute permissions to authenticated users
GRANT EXECUTE ON FUNCTION public.is_provider() TO authenticated;
GRANT EXECUTE ON FUNCTION public.provider_has_patient_access(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_pharmacy_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_own_patient_record(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_own_provider_record(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_group_patient_mappings_for_patient(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_provider_to_group_patients(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.remove_non_owned_patient_mappings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_group_patient_mappings_for_patient(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_provider_to_group_patients(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_non_owned_patient_mappings(uuid) TO service_role;
