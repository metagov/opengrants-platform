{{ config(materialized='view') }}

SELECT 'giveth' AS source, * FROM {{ ref('silver_giveth_grant_pools') }}
-- UNION ALL other sources later (scf, celo, gitcoin, etc.)
