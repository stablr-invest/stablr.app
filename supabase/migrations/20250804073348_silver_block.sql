/*
  # Create protocols table for yield aggregators

  1. New Tables
    - `protocols`
      - `id` (uuid, primary key)
      - `name` (text, protocol name like "Aave")
      - `slug` (text, unique identifier for API calls)
      - `description` (text, protocol description)
      - `website_url` (text, official website)
      - `docs_url` (text, documentation URL)
      - `logo` (text, logo image URL)
      - `color` (text, brand color)
      - `launch_year` (integer, year protocol launched)
      - `verified` (boolean, if protocol is verified)
      - `api_endpoint` (text, API endpoint for fetching data)
      - `api_key_required` (boolean, if API key is needed)
      - `supported_chains` (integer array, chain IDs supported)
      - `protocol_type` (text, type like 'lending', 'dex', 'yield-farming')
      - `created_at` (timestamp)
      - `updated_at` (timestamp)

  2. Security
    - Enable RLS on `protocols` table
    - Add policy for public read access
*/

CREATE TABLE IF NOT EXISTS protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  slug text UNIQUE NOT NULL,
  description text,
  website_url text,
  docs_url text,
  logo text,
  color text DEFAULT '#64748b',
  launch_year integer,
  verified boolean DEFAULT false,
  api_endpoint text,
  api_key_required boolean DEFAULT false,
  supported_chains integer[],
  protocol_type text DEFAULT 'lending',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE protocols ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to protocols"
  ON protocols
  FOR SELECT
  TO public
  USING (true);

-- Insert Aave protocol data
INSERT INTO protocols (
  name,
  slug,
  description,
  website_url,
  docs_url,
  logo,
  color,
  launch_year,
  verified,
  api_endpoint,
  api_key_required,
  supported_chains,
  protocol_type
) VALUES (
  'Aave',
  'aave',
  'Aave is a decentralized non-custodial liquidity market protocol where users can participate as suppliers or borrowers.',
  'https://aave.com',
  'https://docs.aave.com',
  '/aave-logo.png',
  '#B6509E',
  2020,
  true,
  'https://aave-api-v2.aave.com/data',
  false,
  ARRAY[1, 137, 43114, 42161, 10, 8453],
  'lending'
);