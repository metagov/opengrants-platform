

SELECT
    source,
    "grantFundingMechanism" AS funding_mechanism,
    COUNT(*) AS rounds_count,
    SUM("totalGrantPoolSizeInUSD") AS total_pool_size_usd,
    AVG("totalGrantPoolSizeInUSD") AS avg_pool_size_usd
FROM "opengrants"."public"."gold__all_grant_pools"
GROUP BY 1, 2
ORDER BY total_pool_size_usd DESC