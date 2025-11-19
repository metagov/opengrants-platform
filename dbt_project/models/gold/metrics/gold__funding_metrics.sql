{{ config(materialized='table') }}

-- ============================================================
-- Funding Metrics per Ecosystem
-- DAOIP-5 normalized across all grant systems
-- ============================================================

SELECT
    platform as source,
    COUNT(*) AS total_grant_pools,
    SUM(COALESCE(total_pool_size_usd, 0)) AS total_pool_size_usd,
    AVG(NULLIF(total_pool_size_usd, 0)) AS avg_pool_size_usd,
    MIN(NULLIF(total_pool_size_usd, 0)) AS min_pool_size_usd,
    MAX(NULLIF(total_pool_size_usd, 0)) AS max_pool_size_usd,
    SUM(CASE WHEN is_open = true THEN 1 ELSE 0 END) AS currently_open_rounds
FROM {{ ref('gold__all_grant_pools') }}
GROUP BY platform
ORDER BY total_pool_size_usd DESC