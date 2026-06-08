-- Add per-pharmacy outbound drug-name prefix for DigitalRx submissions.
-- Each pharmacy can define its own prefix (e.g. "AIM-"); blank/NULL = send clean drug names.
ALTER TABLE pharmacy_backends ADD COLUMN IF NOT EXISTS drug_name_prefix text;

-- Preserve existing live behavior: every DigitalRx pharmacy currently gets an "AIM-"
-- prefix applied in code, so backfill existing DigitalRx backends to keep it unchanged.
UPDATE pharmacy_backends
SET drug_name_prefix = 'AIM-'
WHERE drug_name_prefix IS NULL AND system_type = 'DigitalRx';
