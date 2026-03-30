{{ config(materialized='table') }}

-- Gitcoin 2.0 System Profile
-- Platform-wide aggregate metrics from the March 2026 CSV snapshot
--
-- FILTERS: Mainnet chains only, fundedAmountInUsd >= $100, totalAmountDonatedInUsd > 0
-- (matching canonical GraphQL query; excludes 1774 empty/test/unnamed rounds)

WITH real_rounds AS (
    SELECT *
    FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}
    WHERE "co.gitcoin.chainId"::integer IN (1, 10, 42, 137, 324, 1088, 1329, 8453, 42161, 42220, 43114, 534352)
      AND "co.gitcoin.fundedAmountInUsd"::numeric >= 100
      AND "co.gitcoin.totalAmountDonatedInUsd"::numeric > 0
)

SELECT
    'gitcoin2' as platform,

    -- Grant Pools (Rounds) Metrics
    (SELECT COUNT(*) FROM real_rounds) as total_grant_pools,
    (SELECT COUNT(*) FROM real_rounds WHERE "isOpen"::boolean = true) as active_grant_pools,
    (SELECT COALESCE(SUM("co.gitcoin.matchAmountInUsd"::numeric), 0) FROM real_rounds) as total_matching_pool_usd,
    (SELECT COALESCE(SUM("co.gitcoin.totalAmountDonatedInUsd"::numeric), 0) FROM real_rounds) as total_donated_via_rounds_usd,
    (SELECT COALESCE(SUM("co.gitcoin.matchAmountInUsd"::numeric), 0) FROM real_rounds) as total_distributed_usd,

    -- Projects Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_projects') }}) as total_projects,

    -- Applications Metrics (populated after silver_gitcoin2_grant_applications is materialized)
    0 as total_applications,
    0 as approved_applications,
    0 as rejected_applications,
    0 as pending_applications,

    -- Donations Metrics (exclude outliers: records with amountInUsd > $50K are raw token values)
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_donations') }} WHERE "amountInUsd" <= 50000) as total_donations,
    (SELECT COALESCE(SUM("amountInUsd"), 0) FROM {{ source('silver', 'silver_gitcoin2_donations') }} WHERE "amountInUsd" <= 50000) as total_donated_usd,
    (SELECT COUNT(DISTINCT "donorAddress") FROM {{ source('silver', 'silver_gitcoin2_donations') }} WHERE "amountInUsd" <= 50000) as unique_donors,
    (SELECT COALESCE(AVG("amountInUsd"), 0) FROM {{ source('silver', 'silver_gitcoin2_donations') }} WHERE "amountInUsd" <= 50000) as avg_donation_usd,

    -- Payouts Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_payouts') }}) as total_payouts,
    (SELECT COALESCE(SUM("amountInUsd"::numeric), 0) FROM {{ source('silver', 'silver_gitcoin2_payouts') }}) as total_paid_out_usd,

    -- Chain Distribution (real rounds only)
    (SELECT COUNT(DISTINCT "co.gitcoin.chainId") FROM real_rounds) as unique_chains,

    -- Funding Mechanism Distribution (real rounds only)
    (SELECT COUNT(*) FROM real_rounds WHERE "grantFundingMechanism" = 'Quadratic Funding') as qf_rounds,
    (SELECT COUNT(*) FROM real_rounds WHERE "grantFundingMechanism" = 'Direct Grants') as direct_grant_rounds,

    NOW() as calculated_at
