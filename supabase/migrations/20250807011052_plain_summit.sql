/*
  # Update subgraph URLs to use The Graph Gateway with API key

  1. Updates
    - Updates Base subgraph URL to use gateway with API key
    - Adds proper gateway URLs for other chains when available
    - Ensures CORS compatibility

  2. Security
    - Uses gateway endpoints which have proper CORS headers
    - API key provides better rate limits and reliability
*/

-- Update Base subgraph URL to use gateway with API key
UPDATE chains 
SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/GQFbb95cE6d8mV989mL5figjaGaKCQB3xqYrr1bRyXqF'
WHERE id = 8453; -- Base

-- Add other gateway URLs with API key for major chains
UPDATE chains 
SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/C2zniPn45RnLDGzVeGZCx2Sw3GXrbc9gL4ZfL8B8Em2j'
WHERE id = 1; -- Ethereum

UPDATE chains 
SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/ELUcwgpm14LKPLrBRuVvPvNKHQ9HvwmtKgKSH6123cr7'
WHERE id = 137; -- Polygon

UPDATE chains 
SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/Cd2gEDVeqnjBn1hSeqFMitw8Q1iiyXHRKWpMses3tMui'
WHERE id = 42161; -- Arbitrum

UPDATE chains 
SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/5jzZEhCztqbKXGLyaZZfkuB2soxRJVwLzoj3RexgF8Vv'
WHERE id = 10; -- Optimism

UPDATE chains 
SET aave_subgraph_url = 'https://gateway.thegraph.com/api/66d1ab8f4cf3da2887af3caf414715ad/subgraphs/id/Hk1Qz6EQXV5GZfbBdVbWjp7835ACFaXsQWNdZJUWjqaT'
WHERE id = 43114; -- Avalanche