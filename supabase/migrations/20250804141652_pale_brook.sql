/*
  # Add color field to stablecoins table

  1. Changes
    - Add `color` column to `stablecoins` table with default values
    - Set USDC to blue (#3B82F6) and USDT to green (#10B981)
    - Update existing records with appropriate colors

  2. Security
    - No RLS changes needed as this is just adding a display field
*/

-- Add color column to stablecoins table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'stablecoins' AND column_name = 'color'
  ) THEN
    ALTER TABLE stablecoins ADD COLUMN color text DEFAULT '#64748b';
  END IF;
END $$;

-- Update existing stablecoins with appropriate colors
UPDATE stablecoins SET color = '#3B82F6' WHERE symbol = 'USDC';
UPDATE stablecoins SET color = '#10B981' WHERE symbol = 'USDT';