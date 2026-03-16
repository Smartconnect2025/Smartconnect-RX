-- Create tiers table for managing provider discount tiers
CREATE TABLE IF NOT EXISTS tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_name TEXT NOT NULL UNIQUE,
  tier_code TEXT NOT NULL UNIQUE,
  discount_percentage NUMERIC(5,2) NOT NULL,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Add comments to document the table and columns
COMMENT ON TABLE tiers IS 'Stores tier information for provider discount management';
COMMENT ON COLUMN tiers.tier_name IS 'Display name of the tier (e.g., Tier 1, Tier 2)';
COMMENT ON COLUMN tiers.tier_code IS 'Code identifier for the tier (e.g., tier1, tier2)';
COMMENT ON COLUMN tiers.discount_percentage IS 'Discount percentage for providers in this tier (e.g., 10.00, 15.50)';
COMMENT ON COLUMN tiers.description IS 'Optional description of what this tier offers';

-- Insert default tiers
INSERT INTO tiers (tier_name, tier_code, discount_percentage, description) VALUES
  ('Tier 1', 'tier1', 10.00, 'Basic tier with 10% discount'),
  ('Tier 2', 'tier2', 15.00, 'Standard tier with 15% discount'),
  ('Tier 3', 'tier3', 20.00, 'Premium tier with 20% discount')
ON CONFLICT (tier_code) DO NOTHING;
