-- Reset verification status for providers who don't have complete addresses
-- This ensures only providers with physical_address AND billing_address are marked as verified/active

UPDATE providers
SET
  is_verified = false,
  is_active = false
WHERE
  physical_address IS NULL
  OR billing_address IS NULL
  OR physical_address::text = 'null'
  OR billing_address::text = 'null'
  OR physical_address::text = '{}'
  OR billing_address::text = '{}'
  OR NOT (
    physical_address->>'street' IS NOT NULL AND physical_address->>'street' != '' AND
    physical_address->>'city' IS NOT NULL AND physical_address->>'city' != '' AND
    physical_address->>'state' IS NOT NULL AND physical_address->>'state' != '' AND
    physical_address->>'zip' IS NOT NULL AND physical_address->>'zip' != '' AND
    billing_address->>'street' IS NOT NULL AND billing_address->>'street' != '' AND
    billing_address->>'city' IS NOT NULL AND billing_address->>'city' != '' AND
    billing_address->>'state' IS NOT NULL AND billing_address->>'state' != '' AND
    billing_address->>'zip' IS NOT NULL AND billing_address->>'zip' != ''
  );

-- Mark providers as verified/active who DO have complete addresses
UPDATE providers
SET
  is_verified = true,
  is_active = true
WHERE
  physical_address IS NOT NULL
  AND billing_address IS NOT NULL
  AND physical_address::text != 'null'
  AND billing_address::text != 'null'
  AND physical_address::text != '{}'
  AND billing_address::text != '{}'
  AND physical_address->>'street' IS NOT NULL AND physical_address->>'street' != ''
  AND physical_address->>'city' IS NOT NULL AND physical_address->>'city' != ''
  AND physical_address->>'state' IS NOT NULL AND physical_address->>'state' != ''
  AND physical_address->>'zip' IS NOT NULL AND physical_address->>'zip' != ''
  AND billing_address->>'street' IS NOT NULL AND billing_address->>'street' != ''
  AND billing_address->>'city' IS NOT NULL AND billing_address->>'city' != ''
  AND billing_address->>'state' IS NOT NULL AND billing_address->>'state' != ''
  AND billing_address->>'zip' IS NOT NULL AND billing_address->>'zip' != ''
  AND first_name IS NOT NULL AND first_name != ''
  AND last_name IS NOT NULL AND last_name != ''
  AND date_of_birth IS NOT NULL
  AND phone_number IS NOT NULL AND phone_number != '';
