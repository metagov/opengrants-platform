{{ config(materialized='table') }}

-- Gitcoin 2.0 Donation Metrics
-- Detailed donation analytics from 497k donation records

WITH donation_stats AS (
    -- Exclude 15 outlier records with raw token values (not USD) where amountInUsd > $50K
    SELECT
        COUNT(*) as total_donations,
        COALESCE(SUM("amountInUsd"), 0) as total_donated_usd,
        COUNT(DISTINCT "donorAddress") as unique_donors,
        COUNT(DISTINCT "recipientAddress") as unique_recipients,
        COUNT(DISTINCT "grantPoolId") as rounds_with_donations,
        COUNT(DISTINCT "projectId") as projects_with_donations,
        COALESCE(AVG("amountInUsd"), 0) as avg_donation_usd,
        COALESCE(MIN("amountInUsd"), 0) as min_donation_usd,
        COALESCE(MAX("amountInUsd"), 0) as max_donation_usd,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "amountInUsd"), 0) as median_donation_usd
    FROM {{ source('silver', 'silver_gitcoin2_donations') }}
    WHERE "amountInUsd" <= 50000
),

donor_engagement AS (
    SELECT
        COUNT(*) FILTER (WHERE donor_donation_count = 1) as one_time_donors,
        COUNT(*) FILTER (WHERE donor_donation_count > 1) as repeat_donors,
        COALESCE(AVG(donor_donation_count), 0) as avg_donations_per_donor,
        COALESCE(MAX(donor_donation_count), 0) as max_donations_by_single_donor
    FROM (
        SELECT
            "donorAddress",
            COUNT(*) as donor_donation_count
        FROM {{ source('silver', 'silver_gitcoin2_donations') }}
        WHERE "amountInUsd" <= 50000
        GROUP BY "donorAddress"
    ) donor_counts
),

chain_breakdown AS (
    SELECT
        COUNT(DISTINCT "co.gitcoin.chainId") as chains_with_donations
    FROM {{ source('silver', 'silver_gitcoin2_donations') }}
)

SELECT
    'gitcoin2' as platform,

    -- Volume Metrics
    ds.total_donations,
    ds.total_donated_usd,
    ds.unique_donors,
    ds.unique_recipients,
    ds.rounds_with_donations,
    ds.projects_with_donations,

    -- Donation Size Metrics
    ds.avg_donation_usd,
    ds.min_donation_usd,
    ds.max_donation_usd,
    ds.median_donation_usd,

    -- Donor Engagement Metrics
    de.one_time_donors,
    de.repeat_donors,
    de.avg_donations_per_donor,
    de.max_donations_by_single_donor,
    CASE
        WHEN ds.unique_donors > 0
        THEN ROUND((de.repeat_donors::numeric / ds.unique_donors) * 100, 2)
        ELSE 0
    END as repeat_donor_percentage,

    -- Chain Coverage
    cb.chains_with_donations,

    NOW() as calculated_at

FROM donation_stats ds
CROSS JOIN donor_engagement de
CROSS JOIN chain_breakdown cb
