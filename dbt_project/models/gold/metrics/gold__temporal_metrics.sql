{{ config(materialized='table') }}

-- ============================================================
-- Temporal Grant Pool Metrics (Quarterly + Yearly Trends)
-- DAOIP-5 normalized across ecosystems
-- ============================================================

WITH base AS (
    SELECT
        source,
        CAST("closeDate" AS TIMESTAMP) AS close_ts,
        COALESCE("totalGrantPoolSizeInUSD", 0) AS total_usd
    FROM {{ ref('gold__all_grant_pools') }}
    WHERE "closeDate" IS NOT NULL
)

SELECT
    source,
    EXTRACT(YEAR FROM close_ts) AS year,
    EXTRACT(QUARTER FROM close_ts) AS quarter,
    COUNT(*) AS total_rounds,
    SUM(total_usd) AS quarterly_funding_usd,
    AVG(NULLIF(total_usd, 0)) AS avg_round_size_usd
FROM base
GROUP BY 1, 2, 3
ORDER BY year DESC, quarter DESC;
