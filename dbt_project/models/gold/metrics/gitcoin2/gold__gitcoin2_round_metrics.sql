{{ config(materialized='table') }}

-- Gitcoin 2.0 Round Metrics
-- Per-round analytics with funding, participation, and payout data
--
-- FILTERS (matching canonical GraphQL query):
--   • Mainnet chains only: 1, 10, 42, 137, 324, 1088, 1329, 8453, 42161, 42220, 43114, 534352
--   • fundedAmountInUsd >= $100 (actual USD in pool; excludes test/empty rounds)
--   • totalAmountDonatedInUsd > 0 (community donations present)

SELECT
    gp.id as round_id,
    gp.name as round_name,
    gp."grantFundingMechanism" as funding_mechanism,
    gp."isOpen"::boolean as is_active,
    gp."closeDate" as close_date,

    -- matchAmountInUsd = committed matching pool in USD (totalGrantPoolSizeInUSD is inflated for some rows)
    gp."co.gitcoin.matchAmountInUsd"::numeric as matching_pool_usd,
    gp."co.gitcoin.fundedAmountInUsd"::numeric as funded_amount_usd,

    -- Chain info
    gp."co.gitcoin.chainId" as chain_id,
    gp."co.gitcoin.strategyName" as strategy_name,

    -- Funding metrics pre-aggregated in rounds table
    COALESCE(gp."co.gitcoin.totalDonationsCount"::integer, 0) as total_donations_count,
    COALESCE(gp."co.gitcoin.uniqueDonorsCount"::integer, 0) as unique_donors_count,
    COALESCE(gp."co.gitcoin.totalAmountDonatedInUsd"::numeric, 0) as total_amount_donated_usd,
    COALESCE(gp."co.gitcoin.matchAmount"::numeric, 0) as match_amount_usd,
    COALESCE(gp."co.gitcoin.totalDistributed"::numeric, 0) as total_distributed_usd,

    -- Application counts (0 until silver_gitcoin2_grant_applications is materialized)
    0 as total_applications,
    0 as approved_applications,
    0 as rejected_applications,
    0 as pending_applications,
    0 as approval_rate_pct,

    -- Donation stats (from raw silver donations table)
    COALESCE(don_stats.donations_count, 0) as verified_donations_count,
    COALESCE(don_stats.donations_total_usd, 0) as verified_donations_usd,
    COALESCE(don_stats.unique_donors, 0) as verified_unique_donors,
    COALESCE(don_stats.avg_donation_usd, 0) as avg_donation_usd,

    -- Payout stats
    COALESCE(pay_stats.payouts_count, 0) as payouts_count,
    COALESCE(pay_stats.payouts_total_usd, 0) as payouts_total_usd,

    -- Timing
    gp."co.gitcoin.applicationsStartTime" as applications_start,
    gp."co.gitcoin.applicationsEndTime" as applications_end,
    gp."co.gitcoin.donationsStartTime" as donations_start,
    gp."co.gitcoin.donationsEndTime" as donations_end,

    NOW() as calculated_at

FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }} gp

LEFT JOIN (
    SELECT
        "grantPoolId" as grant_pool_id,
        COUNT(*) as donations_count,
        COALESCE(SUM("amountInUsd"::numeric), 0) as donations_total_usd,
        COUNT(DISTINCT "donorAddress") as unique_donors,
        COALESCE(AVG("amountInUsd"::numeric), 0) as avg_donation_usd
    FROM {{ source('silver', 'silver_gitcoin2_donations') }}
    WHERE "amountInUsd" <= 50000
    GROUP BY "grantPoolId"
) don_stats ON gp.id = don_stats.grant_pool_id

LEFT JOIN (
    SELECT
        "grantPoolId" as grant_pool_id,
        COUNT(*) as payouts_count,
        COALESCE(SUM("amountInUsd"::numeric), 0) as payouts_total_usd
    FROM {{ source('silver', 'silver_gitcoin2_payouts') }}
    GROUP BY "grantPoolId"
) pay_stats ON gp.id = pay_stats.grant_pool_id

-- Mainnet only, real funded rounds with community donations
WHERE gp."co.gitcoin.chainId"::integer IN (1, 10, 42, 137, 324, 1088, 1329, 8453, 42161, 42220, 43114, 534352)
  AND gp."co.gitcoin.fundedAmountInUsd"::numeric >= 100
  AND gp."co.gitcoin.totalAmountDonatedInUsd"::numeric > 0

ORDER BY gp."co.gitcoin.matchAmountInUsd"::numeric DESC NULLS LAST
