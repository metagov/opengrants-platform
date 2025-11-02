{{ config(materialized='view') }}

SELECT
  'Giveth' AS source,
  *
FROM {{ source('silver', 'silver_giveth_projects') }}
-- UNION ALL other sources later (scf, celo, gitcoin, etc.)

