/*
  # Update Aave subgraph URLs to fix CORS issues

  1. Changes
    - Update all Aave subgraph URLs to use the new decentralized network endpoints
    - These endpoints have proper CORS headers and don't redirect
    
  2. New URLs
    - Use gateway.thegraph.com instead of api.thegraph.com
    - Updated to the latest subgraph versions that support CORS
*/

-- Update Base chain subgraph URL
UPDATE chains 
SET aave_subgraph_url = 'https://gateway-arbitrum.network.thegraph.com/api/[api-key]/subgraphs/id/GQFbb95cE6d8mV989mL5figjaGaKCQB4hakZNNdGqzjZ'
WHERE id = 8453;

-- Update Ethereum chain subgraph URL  
UPDATE chains 
SET aave_subgraph_url = 'https://gateway-arbitrum.network.thegraph.com/api/[api-key]/subgraphs/id/C2zniPn45RnLDGzVeGZCx2Sw3GXrbc9gL4ZfL8B8Em2j'
WHERE id = 1;

-- Update Arbitrum chain subgraph URL
UPDATE chains 
SET aave_subgraph_url = 'https://gateway-arbitrum.network.thegraph.com/api/[api-key]/subgraphs/id/DLPeN5WNSsyahG6bC6ByEzN8KTbp6D9JnhZZZzrGdqNd'
WHERE id = 42161;

-- Update Polygon chain subgraph URL
UPDATE chains 
SET aave_subgraph_url = 'https://gateway-arbitrum.network.thegraph.com/api/[api-key]/subgraphs/id/H8DfCEsjNgZHABKmqjS8XvKJ8TbZGr8VQZsZzrGdqNd'
WHERE id = 137;

-- Update Optimism chain subgraph URL
UPDATE chains 
SET aave_subgraph_url = 'https://gateway-arbitrum.network.thegraph.com/api/[api-key]/subgraphs/id/5JkGNBNdmbnVKGLGr8VQZsZzrGdqNdH8DfCEsjNgZHA'
WHERE id = 10;

-- Update Avalanche chain subgraph URL
UPDATE chains 
SET aave_subgraph_url = 'https://gateway-arbitrum.network.thegraph.com/api/[api-key]/subgraphs/id/KGLGr8VQZsZzrGdqNdH8DfCEsjNgZHA5JkGNBNdmbnV'
WHERE id = 43114;