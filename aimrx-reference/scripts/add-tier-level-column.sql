-- Add tier_level column to providers table
-- This column stores the tier level assigned by admin (tier1, tier2, tier3)
-- Each tier has a different discount rate for the provider

ALTER TABLE providers
ADD COLUMN IF NOT EXISTS tier_level TEXT;

-- Add a comment to document the column
COMMENT ON COLUMN providers.tier_level IS 'Tier level set by admin (tier1, tier2, tier3, tier4) - each tier has different discount rate';
