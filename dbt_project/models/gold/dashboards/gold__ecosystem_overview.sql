{{ config(materialized='table') }}

-- ============================================================
-- Cross-ecosystem Funding Overview (DAOIP-5 unified)
-- ============================================================

WITH funding AS (
    SELECT
        source,
        SUM(COALESCE("totalGrantPoolSizeInUSD", 0)) AS total_pool_size_usd,
        AVG(NULLIF("totalGrantPoolSizeInUSD", 0)) AS avg_pool_size_usd
    FROM {{ ref('gold__all_grant_pools') }}
    GROUP BY source
),

donations AS (
    SELECT
        source,
        SUM(COALESCE(total_donations_usd, 0)) AS total_donations_usd,
        SUM(COALESCE(total_projects, 0)) AS total_projects,
        SUM(COALESCE(total_unique_donors, 0)) AS total_unique_donors
    FROM {{ ref('gold__donation_metrics') }}
    GROUP BY source
)

SELECT
    f.source,
    f.total_pool_size_usd,
    f.avg_pool_size_usd,
    COALESCE(d.total_donations_usd, 0) AS total_donations_usd,
    COALESCE(d.total_projects, 0) AS total_projects,
    COALESCE(d.total_unique_donors, 0) AS total_unique_donors
FROM funding f
LEFT JOIN donations d ON f.source = d.source
ORDER BY f.total_pool_size_usd DESC;
