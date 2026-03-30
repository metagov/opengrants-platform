{{ config(materialized='table') }}

-- Pre-materialized donation size distribution (7 buckets)
-- Avoids scanning 497K silver_gitcoin2_donations rows on every API request

SELECT
    CASE
        WHEN "amountInUsd"::numeric < 1    THEN 'Under $1'
        WHEN "amountInUsd"::numeric < 10   THEN '$1-$10'
        WHEN "amountInUsd"::numeric < 50   THEN '$10-$50'
        WHEN "amountInUsd"::numeric < 100  THEN '$50-$100'
        WHEN "amountInUsd"::numeric < 500  THEN '$100-$500'
        WHEN "amountInUsd"::numeric < 1000 THEN '$500-$1K'
        ELSE '$1K+'
    END as range,
    COUNT(*) as donation_count,
    COALESCE(SUM("amountInUsd"::numeric), 0) as total_amount,
    CASE
        WHEN "amountInUsd"::numeric < 1    THEN 1
        WHEN "amountInUsd"::numeric < 10   THEN 2
        WHEN "amountInUsd"::numeric < 50   THEN 3
        WHEN "amountInUsd"::numeric < 100  THEN 4
        WHEN "amountInUsd"::numeric < 500  THEN 5
        WHEN "amountInUsd"::numeric < 1000 THEN 6
        ELSE 7
    END as sort_order
FROM {{ source('silver', 'silver_gitcoin2_donations') }}
WHERE "amountInUsd" IS NOT NULL
  AND "amountInUsd" <= 50000
GROUP BY 1, sort_order
ORDER BY sort_order
