{{ config(materialized='table') }}

-- ============================================================
-- Funding Metrics per Ecosystem
-- DAOIP-5 normalized across all grant systems
-- ============================================================

SELECT
    source,
    COUNT(*) AS total_grant_pools,
    SUM(COALESCE("totalGrantPoolSizeInUSD", 0)) AS total_pool_size_usd,
    AVG(NULLIF("totalGrantPoolSizeInUSD", 0)) AS avg_pool_size_usd,
    MIN(NULLIF("totalGrantPoolSizeInUSD", 0)) AS min_pool_size_usd,
    MAX(NULLIF("totalGrantPoolSizeInUSD", 0)) AS max_pool_size_usd,
    SUM(
        CASE 
            WHEN COALESCE("isOpen", FALSE) THEN 1 ELSE 0 
        END
    ) AS currently_open_rounds
FROM {{ ref('gold__all_grant_pools') }}
GROUP BY source
ORDER BY total_pool_size_usd DESC;
