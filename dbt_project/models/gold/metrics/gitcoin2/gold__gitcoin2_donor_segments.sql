{{ config(materialized='table') }}

-- Gitcoin 2.0 Donor Segmentation
-- QF health signal: community breadth, loyalty, and concentration
-- Donations table uses co.gitcoin.* namespace (materialized before rename)

WITH donor_stats AS (
    SELECT
        "donorAddress",
        COUNT(*) as total_donations,
        COUNT(DISTINCT "grantPoolId") as rounds_donated_to,
        COUNT(DISTINCT "projectId") as projects_supported,
        COUNT(DISTINCT "co.gitcoin.chainId") as chains_donated_on,
        COALESCE(SUM("amountInUsd"::numeric), 0) as total_donated_usd,
        COALESCE(AVG("amountInUsd"::numeric), 0) as avg_donation_usd,
        MIN("timestamp") as first_donation_at,
        MAX("timestamp") as last_donation_at
    FROM {{ source('silver', 'silver_gitcoin2_donations') }}
    GROUP BY "donorAddress"
),

segmented AS (
    SELECT
        *,
        -- Priority order matters: micro < loyal < cross_chain < breadth < whale < standard
        -- A donor gets the highest-priority segment that applies
        CASE
            WHEN total_donated_usd < 1.0             THEN 'micro'        -- <$1 total: democratic QF base
            WHEN total_donated_usd >= 1000            THEN 'whale'        -- $1000+ total: concentration risk
            WHEN rounds_donated_to >= 3               THEN 'loyal'        -- 3+ rounds: cross-round returner
            WHEN chains_donated_on >= 2               THEN 'cross_chain'  -- 2+ chains: multi-chain participant
            WHEN projects_supported >= 5              THEN 'breadth'      -- 5+ projects: QF power user
            ELSE                                           'standard'
        END as segment
    FROM donor_stats
)

SELECT
    segment,
    COUNT(*) as donor_count,
    ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) as pct_of_total_donors,
    ROUND(AVG(rounds_donated_to), 2) as avg_rounds_donated_to,
    ROUND(AVG(chains_donated_on), 2) as avg_chains_donated_on,
    ROUND(AVG(total_donated_usd), 2) as avg_total_donated_usd,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_donated_usd)::numeric, 4) as median_total_donated_usd,
    ROUND(AVG(projects_supported), 2) as avg_projects_supported,
    ROUND(AVG(total_donations), 2) as avg_donations_count,
    ROUND(SUM(total_donated_usd), 2) as total_donated_usd_segment,
    ROUND(SUM(total_donated_usd) / NULLIF(SUM(SUM(total_donated_usd)) OVER (), 0) * 100, 2) as pct_of_total_volume,
    NOW() as calculated_at

FROM segmented
GROUP BY segment
ORDER BY donor_count DESC
