{{ config(materialized='view') }}

SELECT
  'Giveth' AS source,
  *
FROM {{ source('silver', 'silver_giveth_grant_pools') }}
-- UNION ALL other sources later (scf, celo, gitcoin, etc.)