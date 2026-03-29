{{ config(materialized='table') }}

-- Gitcoin 2.0 QF Round Analysis
-- Core QF mechanics per round: amplification, donor breadth, concentration
--
-- QF amplification = total distributed / community donated
-- High amplification + high unique donors = healthy democratic QF
-- High top-donor concentration = potential sybil / whale dominance risk
--
-- grant_pools uses co.gitcoin.* namespace; donations uses co.gitcoin.*

WITH raw_donation_stats AS (
    -- Per-donation aggregation: counts, totals, avg, median
    SELECT
        "grantPoolId",
        COUNT(*) as raw_donation_count,
        COUNT(DISTINCT "donorAddress") as unique_donors_raw,
        COALESCE(SUM("amountInUsd"::numeric), 0) as total_donated_usd_raw,
        COUNT(DISTINCT "projectId") as projects_receiving_donations,
        COALESCE(AVG("amountInUsd"::numeric), 0) as avg_donation_usd,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "amountInUsd"::numeric)::numeric, 0) as median_donation_usd
    FROM {{ source('silver', 'silver_gitcoin2_donations') }}
    GROUP BY "grantPoolId"
),

per_donor_totals AS (
    -- Per-donor sum within each round, for dispersion calculation
    SELECT
        "grantPoolId",
        "donorAddress",
        SUM("amountInUsd"::numeric) as donor_total_usd
    FROM {{ source('silver', 'silver_gitcoin2_donations') }}
    WHERE "amountInUsd" IS NOT NULL
    GROUP BY "grantPoolId", "donorAddress"
),

donor_dispersion AS (
    SELECT
        "grantPoolId",
        COALESCE(STDDEV(donor_total_usd)::numeric, 0) as donor_amount_stddev
    FROM per_donor_totals
    GROUP BY "grantPoolId"
),

round_donation_stats AS (
    SELECT
        rds.*,
        dd.donor_amount_stddev
    FROM raw_donation_stats rds
    LEFT JOIN donor_dispersion dd ON rds."grantPoolId" = dd."grantPoolId"
),

top_donor_concentration AS (
    -- % of round donations from top 10 donors (sybil / whale signal)
    SELECT
        "grantPoolId",
        ROUND(
            SUM(donor_usd) FILTER (WHERE donor_rank <= 10) /
            NULLIF(SUM(donor_usd), 0) * 100,
        2) as top_10_donor_concentration_pct,
        ROUND(
            SUM(donor_usd) FILTER (WHERE donor_rank <= 1) /
            NULLIF(SUM(donor_usd), 0) * 100,
        2) as top_donor_concentration_pct
    FROM (
        SELECT
            "grantPoolId",
            "donorAddress",
            SUM("amountInUsd"::numeric) as donor_usd,
            RANK() OVER (
                PARTITION BY "grantPoolId"
                ORDER BY SUM("amountInUsd"::numeric) DESC
            ) as donor_rank
        FROM {{ source('silver', 'silver_gitcoin2_donations') }}
        WHERE "amountInUsd" IS NOT NULL
        GROUP BY "grantPoolId", "donorAddress"
    ) ranked
    GROUP BY "grantPoolId"
),

payout_stats AS (
    SELECT
        "grantPoolId",
        COUNT(DISTINCT "applicationId") as projects_paid_out,
        COALESCE(SUM("amountInUsd"::numeric), 0) as total_distributed_usd_raw
    FROM {{ source('silver', 'silver_gitcoin2_payouts') }}
    GROUP BY "grantPoolId"
)

SELECT
    gp.id as round_id,
    gp.name as round_name,
    gp."co.gitcoin.chainId"::integer as chain_id,
    gp."co.gitcoin.strategyName" as strategy_name,
    gp."grantFundingMechanism" as funding_mechanism,
    gp."isOpen"::boolean as is_active,

    -- Pool composition
    COALESCE(gp."totalGrantPoolSizeInUSD"::numeric, 0) as match_pool_usd,
    COALESCE(gp."co.gitcoin.matchAmount"::numeric, 0) as match_amount,
    COALESCE(gp."co.gitcoin.matchAmountInUsd"::numeric, 0) as match_amount_usd,
    COALESCE(gp."co.gitcoin.matchTokenAddress", '') as match_token_address,

    -- Community donations (prefer pre-aggregated from grant_pools, fallback to raw)
    COALESCE(
        NULLIF(gp."co.gitcoin.totalAmountDonatedInUsd"::numeric, 0),
        rds.total_donated_usd_raw
    ) as community_donated_usd,

    COALESCE(
        NULLIF(gp."co.gitcoin.uniqueDonorsCount"::integer, 0),
        rds.unique_donors_raw
    ) as unique_donors,

    COALESCE(
        NULLIF(gp."co.gitcoin.totalDonationsCount"::integer, 0),
        rds.raw_donation_count
    ) as donations_count,

    -- Distribution
    COALESCE(
        NULLIF(gp."co.gitcoin.totalDistributed"::numeric, 0),
        ps.total_distributed_usd_raw
    ) as total_distributed_usd,

    -- QF AMPLIFICATION RATIO
    -- For every $1 the community donated, how much total did projects receive?
    -- Ratio > 1 = matching is amplifying community signal
    ROUND(
        COALESCE(
            NULLIF(gp."co.gitcoin.totalDistributed"::numeric, 0),
            ps.total_distributed_usd_raw, 0
        ) / NULLIF(
            COALESCE(
                NULLIF(gp."co.gitcoin.totalAmountDonatedInUsd"::numeric, 0),
                rds.total_donated_usd_raw
            ), 0
        ),
    2) as qf_amplification_ratio,

    -- BREADTH SIGNAL: avg donors per project in this round
    -- High value = community support spread across many projects
    ROUND(
        COALESCE(
            NULLIF(gp."co.gitcoin.uniqueDonorsCount"::integer, 0),
            rds.unique_donors_raw, 0
        )::numeric / NULLIF(rds.projects_receiving_donations, 0),
    2) as avg_donors_per_project,

    -- Per-donation stats (from raw donations)
    ROUND(rds.avg_donation_usd, 4) as avg_donation_usd,
    ROUND(rds.median_donation_usd, 4) as median_donation_usd,
    COALESCE(rds.projects_receiving_donations, 0) as projects_receiving_donations,
    COALESCE(ps.projects_paid_out, 0) as projects_paid_out,

    -- CONCENTRATION RISK (sybil / whale dominance signal)
    tdc.top_10_donor_concentration_pct,
    tdc.top_donor_concentration_pct,

    -- Donor amount dispersion (lower = more democratic donation sizes)
    ROUND(rds.donor_amount_stddev, 2) as donor_amount_stddev,

    -- Timing
    gp."co.gitcoin.donationsStartTime" as donations_start,
    gp."co.gitcoin.donationsEndTime" as donations_end,
    CASE
        WHEN gp."co.gitcoin.donationsStartTime" IS NOT NULL
          AND gp."co.gitcoin.donationsEndTime" IS NOT NULL
        THEN EXTRACT(DAY FROM (
            gp."co.gitcoin.donationsEndTime"::timestamp -
            gp."co.gitcoin.donationsStartTime"::timestamp
        ))::integer
        ELSE NULL
    END as round_duration_days,
    gp."co.gitcoin.applicationsStartTime" as applications_start,
    gp."co.gitcoin.applicationsEndTime" as applications_end,

    NOW() as calculated_at

FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }} gp
LEFT JOIN round_donation_stats rds ON gp.id = rds."grantPoolId"
LEFT JOIN top_donor_concentration tdc ON gp.id = tdc."grantPoolId"
LEFT JOIN payout_stats ps ON gp.id = ps."grantPoolId"

ORDER BY COALESCE(
    NULLIF(gp."co.gitcoin.totalAmountDonatedInUsd"::numeric, 0),
    rds.total_donated_usd_raw, 0
) DESC NULLS LAST
