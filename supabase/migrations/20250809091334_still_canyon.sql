/*
  # Add application configuration table

  1. New Tables
    - `app_config`
      - `id` (uuid, primary key)
      - `key` (text, unique) - Configuration key name
      - `value` (text) - Configuration value
      - `description` (text) - Human readable description
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `app_config` table
    - Add policy for public read access to configuration

  3. Initial Data
    - Insert default configuration values for Stablr fee settings
*/

CREATE TABLE IF NOT EXISTS app_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  key text UNIQUE NOT NULL,
  value text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE app_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to app_config"
  ON app_config
  FOR SELECT
  TO public
  USING (true);

-- Insert default configuration values
INSERT INTO app_config (key, value, description) VALUES
  ('STABLR_FEE_ROUTER', '', 'Optional fee router contract address for single-transaction withdrawals'),
  ('STABLR_FEE_BPS', '100', 'Stablr fee in basis points (100 = 1.00%)'),
  ('STABLR_TREASURY', '0xb60DEa2837cf00b556A824aA9b7bd6E58aD8C8D1', 'Treasury address for collecting Stablr fees')
ON CONFLICT (key) DO NOTHING;