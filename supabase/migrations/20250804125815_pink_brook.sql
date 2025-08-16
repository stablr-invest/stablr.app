/*
  # Add enabled flag to chains table

  1. Schema Changes
    - Add `enabled` boolean column to `chains` table with default value `true`
    - Update existing chains to be enabled by default

  2. Data Updates
    - Set all existing chains to enabled=true
    - This ensures backward compatibility

  3. Notes
    - New chains will be enabled by default
    - Frontend will filter to only show enabled chains
*/

-- Add enabled column to chains table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chains' AND column_name = 'enabled'
  ) THEN
    ALTER TABLE chains ADD COLUMN enabled boolean DEFAULT true NOT NULL;
  END IF;
END $$;

-- Update all existing chains to be enabled
UPDATE chains SET enabled = true WHERE enabled IS NULL;