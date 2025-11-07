{{ config(materialized='table') }}

-- ============================================================
-- Distribution of Grant Funding Mechanisms
-- ============================================================

SELECT
    source,
    COALESCE("grantFundingMechanism", 'Unknown') AS funding_mechanism,
    COUNT(*) AS rounds_count,
    SUM(COALESCE("totalGrantPoolSizeInUSD", 0)) AS total_pool_size_usd,
    AVG(NULLIF("totalGrantPoolSizeInUSD", 0)) AS avg_pool_size_usd
FROM {{ ref('gold__all_grant_pools') }}
GROUP BY 1, 2
ORDER BY total_pool_size_usd DESC;
