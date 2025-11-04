-- dbt_project/models/gold/metrics/gold__temporal_metrics.sql   
{{ config(materialized='table') }}

SELECT
    source,
    EXTRACT(YEAR FROM "closeDate"::timestamp) AS year,
    EXTRACT(QUARTER FROM "closeDate"::timestamp) AS quarter,
    COUNT(*) AS rounds_count,
    SUM("totalGrantPoolSizeInUSD") AS quarterly_funding_usd
FROM {{ ref('gold__all_grant_pools') }}
WHERE "closeDate" IS NOT NULL
GROUP BY 1, 2, 3
ORDER BY 2, 3
