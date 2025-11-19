{{ config(materialized='table') }}

SELECT
    platform as source,
    COALESCE(funding_mechanism, 'Unknown') AS funding_mechanism,
    COUNT(*) AS rounds_count,
    SUM(COALESCE(total_pool_size_usd, 0)) AS total_pool_size_usd,
    AVG(NULLIF(total_pool_size_usd, 0)) AS avg_pool_size_usd
FROM {{ ref('gold__all_grant_pools') }}
GROUP BY platform, funding_mechanism
ORDER BY total_pool_size_usd DESC