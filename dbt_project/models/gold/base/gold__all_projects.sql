--dbt_project/models/gold/base/gold__all_projects.sql
{{ config(materialized='view') }}

-- Unified projects view across ecosystems (Giveth, SCF, etc.)
SELECT
  'Giveth' AS source,
  *
FROM {{ source('silver', 'silver_giveth_projects') }}

UNION ALL

SELECT
  'SCF' AS source,
  *
FROM {{ source('silver', 'silver_scf_projects') }}


