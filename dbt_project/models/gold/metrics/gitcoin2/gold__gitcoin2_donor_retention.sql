{{ config(materialized='table') }}

-- Gitcoin 2.0 Donor Retention Cohorts
-- Year-over-year cohort analysis: are donors returning?
-- Cohort = year of donor's FIRST donation ever

WITH donor_cohorts AS (
    SELECT
        "donorAddress",
        EXTRACT(YEAR FROM MIN("timestamp"::timestamp))::integer as cohort_year
    FROM {{ source('silver', 'silver_gitcoin2_donations') }}
    WHERE "timestamp" IS NOT NULL AND "amountInUsd" <= 50000
    GROUP BY "donorAddress"
),

donor_year_flags AS (
    -- For each donor, compute flags for return in year+1, year+2, and ever
    SELECT
        dc."donorAddress",
        dc.cohort_year,
        MAX(CASE
            WHEN EXTRACT(YEAR FROM d."timestamp"::timestamp)::integer = dc.cohort_year + 1
            THEN 1 ELSE 0
        END) as returned_year_1,
        MAX(CASE
            WHEN EXTRACT(YEAR FROM d."timestamp"::timestamp)::integer = dc.cohort_year + 2
            THEN 1 ELSE 0
        END) as returned_year_2,
        MAX(CASE
            WHEN EXTRACT(YEAR FROM d."timestamp"::timestamp)::integer > dc.cohort_year
            THEN 1 ELSE 0
        END) as ever_returned,
        COALESCE(SUM(d."amountInUsd"::numeric), 0) as lifetime_donated_usd,
        COUNT(DISTINCT d."grantPoolId") as rounds_donated_to,
        COUNT(DISTINCT d."projectId") as projects_supported,
        COUNT(*) as total_donations
    FROM donor_cohorts dc
    JOIN {{ source('silver', 'silver_gitcoin2_donations') }} d
        ON dc."donorAddress" = d."donorAddress"
    WHERE dc.cohort_year >= 2019
      AND d."amountInUsd" <= 50000
    GROUP BY dc."donorAddress", dc.cohort_year
)

SELECT
    cohort_year,
    COUNT(*) as cohort_size,
    SUM(returned_year_1) as retained_year_1,
    SUM(returned_year_2) as retained_year_2,
    SUM(ever_returned) as ever_returned,

    -- Retention rates
    ROUND(SUM(returned_year_1)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as year_1_retention_pct,
    ROUND(SUM(returned_year_2)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as year_2_retention_pct,
    ROUND(SUM(ever_returned)::numeric / NULLIF(COUNT(*), 0) * 100, 2) as ever_returned_pct,

    -- Cohort behavior averages
    ROUND(AVG(lifetime_donated_usd)::numeric, 2) as cohort_avg_donated_usd,
    ROUND(SUM(lifetime_donated_usd)::numeric, 2) as cohort_total_donated_usd,
    ROUND(AVG(rounds_donated_to)::numeric, 2) as cohort_avg_rounds_donated,
    ROUND(AVG(projects_supported)::numeric, 2) as cohort_avg_projects_supported,
    ROUND(AVG(total_donations)::numeric, 2) as cohort_avg_donation_count,

    -- Returning donor subset stats
    ROUND(AVG(lifetime_donated_usd) FILTER (WHERE ever_returned = 1)::numeric, 2) as returning_donor_avg_donated_usd,
    ROUND(AVG(lifetime_donated_usd) FILTER (WHERE ever_returned = 0)::numeric, 2) as one_time_donor_avg_donated_usd,

    NOW() as calculated_at

FROM donor_year_flags
GROUP BY cohort_year
ORDER BY cohort_year
