{{ config(materialized='table') }}

-- Pre-materialized monthly donation rollup (~30 rows)
-- Avoids scanning 497K silver_gitcoin2_donations rows on every API request

SELECT
    TO_CHAR(DATE_TRUNC('month', "timestamp"::timestamp), 'YYYY-MM') as month,
    COUNT(*) as donation_count,
    COALESCE(SUM("amountInUsd"), 0) as total_donated,
    COUNT(DISTINCT "donorAddress") as unique_donors
FROM {{ source('silver', 'silver_gitcoin2_donations') }}
WHERE "timestamp" IS NOT NULL
  AND "timestamp" != 'None'
  AND "amountInUsd" <= 50000
GROUP BY DATE_TRUNC('month', "timestamp"::timestamp)
ORDER BY month ASC
