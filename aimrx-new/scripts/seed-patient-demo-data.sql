-- ========================================
-- SEED REALISTIC DEMO DATA FOR PATIENT CHART
-- ========================================
-- This adds realistic medications, allergies, conditions, and labs
-- to make the patient chart look like a real EHR
-- Run this after you have at least one patient in the system
-- ========================================

-- Get the first patient ID (or update this to your specific patient)
DO $$
DECLARE
  demo_patient_id UUID;
  demo_provider_id UUID;
BEGIN
  -- Get first patient
  SELECT id INTO demo_patient_id FROM patients LIMIT 1;

  -- Get first provider
  SELECT id INTO demo_provider_id FROM providers LIMIT 1;

  IF demo_patient_id IS NULL THEN
    RAISE EXCEPTION 'No patients found. Create a patient first.';
  END IF;

  IF demo_provider_id IS NULL THEN
    RAISE EXCEPTION 'No providers found. Create a provider first.';
  END IF;

  RAISE NOTICE 'Adding demo data for patient: %', demo_patient_id;

  -- ========================================
  -- ADD MEDICATIONS
  -- ========================================
  INSERT INTO medications (patient_id, name, dosage, frequency, start_date, status, notes, created_at, updated_at)
  VALUES
    (demo_patient_id, 'Lisinopril', '10mg', 'Daily', CURRENT_DATE - INTERVAL '6 months', 'active', 'For hypertension', NOW(), NOW()),
    (demo_patient_id, 'Metformin', '500mg', 'Twice daily', CURRENT_DATE - INTERVAL '1 year', 'active', 'For type 2 diabetes', NOW(), NOW()),
    (demo_patient_id, 'Atorvastatin', '20mg', 'Nightly', CURRENT_DATE - INTERVAL '3 months', 'active', 'For cholesterol', NOW(), NOW())
  ON CONFLICT DO NOTHING;

  -- ========================================
  -- ADD ALLERGIES
  -- ========================================
  INSERT INTO allergies (patient_id, allergen, reaction, severity, notes, created_at, updated_at)
  VALUES
    (demo_patient_id, 'Penicillin', 'Rash, hives', 'severe', 'Documented allergy since childhood', NOW(), NOW()),
    (demo_patient_id, 'Sulfa drugs', 'Nausea, vomiting', 'moderate', 'Patient reports sensitivity', NOW(), NOW())
  ON CONFLICT DO NOTHING;

  -- ========================================
  -- ADD CONDITIONS
  -- ========================================
  INSERT INTO conditions (patient_id, name, diagnosis_date, status, notes, icd10_code, created_at, updated_at)
  VALUES
    (demo_patient_id, 'Hypertension', CURRENT_DATE - INTERVAL '2 years', 'active', 'Essential hypertension, well-controlled on medication', 'I10', NOW(), NOW()),
    (demo_patient_id, 'Type 2 Diabetes Mellitus', CURRENT_DATE - INTERVAL '3 years', 'active', 'Managed with metformin, A1C 7.2%', 'E11.9', NOW(), NOW()),
    (demo_patient_id, 'Hyperlipidemia', CURRENT_DATE - INTERVAL '1 year', 'active', 'LDL 112 mg/dL on atorvastatin', 'E78.5', NOW(), NOW())
  ON CONFLICT DO NOTHING;

  RAISE NOTICE 'Demo data added successfully!';
  RAISE NOTICE 'Patient now has:';
  RAISE NOTICE '- 3 active medications (Lisinopril, Metformin, Atorvastatin)';
  RAISE NOTICE '- 2 allergies (Penicillin - severe, Sulfa drugs - moderate)';
  RAISE NOTICE '- 3 active conditions (Hypertension, Type 2 Diabetes, Hyperlipidemia)';
END $$;

-- ========================================
-- VERIFY DATA WAS ADDED
-- ========================================
SELECT
  'Medications' as data_type,
  COUNT(*) as count
FROM medications
WHERE patient_id IN (SELECT id FROM patients LIMIT 1)
UNION ALL
SELECT
  'Allergies' as data_type,
  COUNT(*) as count
FROM allergies
WHERE patient_id IN (SELECT id FROM patients LIMIT 1)
UNION ALL
SELECT
  'Conditions' as data_type,
  COUNT(*) as count
FROM conditions
WHERE patient_id IN (SELECT id FROM patients LIMIT 1);
