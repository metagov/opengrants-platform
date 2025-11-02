{{ config(materialized='table') }}

SELECT
    source,
    SUM("totalGrantPoolSizeInUSD") AS total_funding_usd,
    AVG("totalGrantPoolSizeInUSD") AS avg_pool_size_usd,
    COUNT(*) AS total_rounds,
    MIN("totalGrantPoolSizeInUSD") AS min_pool_size_usd,
    MAX("totalGrantPoolSizeInUSD") AS max_pool_size_usd
FROM {{ ref('gold__all_grant_pools') }}
GROUP BY source
