-- ================================================
-- Clinic Patient Sharing Functions (by company_name)
-- ================================================
-- When providers belong to the same company (company_name), they should
-- automatically share access to all patients in that company.

-- Function 1: Sync patient mappings for all company members when a patient is created
-- Called after a provider creates a patient to give all other providers
-- in the same company access to that patient.
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
  v_company_name text;
BEGIN
  SELECT LOWER(TRIM(company_name)) INTO v_company_name
  FROM public.providers
  WHERE id = p_creator_provider_id;

  IF v_company_name IS NULL OR v_company_name = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.provider_patient_mappings (provider_id, patient_id)
  SELECT p.id, p_patient_id
  FROM public.providers p
  WHERE LOWER(TRIM(p.company_name)) = v_company_name
    AND p.id != p_creator_provider_id
    AND p.is_active = true
  ON CONFLICT (provider_id, patient_id) DO NOTHING;
END;
$$;

-- Function 2: Sync a provider to all existing patients in their company
-- Called when a new provider joins a company to give them
-- access to all existing patients in that company.
CREATE OR REPLACE FUNCTION public.sync_provider_to_group_patients(
  p_provider_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_company_name text;
BEGIN
  SELECT LOWER(TRIM(company_name)) INTO v_company_name
  FROM public.providers
  WHERE id = p_provider_id;

  IF v_company_name IS NULL OR v_company_name = '' THEN
    RETURN;
  END IF;

  INSERT INTO public.provider_patient_mappings (provider_id, patient_id)
  SELECT p_provider_id, ppm.patient_id
  FROM public.provider_patient_mappings ppm
  JOIN public.providers p ON p.id = ppm.provider_id
  WHERE LOWER(TRIM(p.company_name)) = v_company_name
    AND p.id != p_provider_id
  ON CONFLICT (provider_id, patient_id) DO NOTHING;
END;
$$;

-- Function 3: Remove all patient mappings for a provider EXCEPT patients they created
-- Called when a provider is removed from a company to clean up shared access.
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION public.sync_group_patient_mappings_for_patient(uuid, uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_provider_to_group_patients(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_non_owned_patient_mappings(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.sync_group_patient_mappings_for_patient(uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_provider_to_group_patients(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.remove_non_owned_patient_mappings(uuid) TO service_role;
