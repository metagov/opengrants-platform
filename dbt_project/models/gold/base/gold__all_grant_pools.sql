--dbt_project/models/gold/base/gold__all_grant_pools.sql

{{ config(materialized='view') }}

-- Unified grant pools view across ecosystems (Giveth, SCF, and more)
SELECT
  'Giveth' AS source,
  *
FROM {{ source('silver', 'silver_giveth_grant_pools') }}

UNION ALL

SELECT
  'SCF' AS source,
  *
FROM {{ source('silver', 'silver_scf_grant_pools') }}

