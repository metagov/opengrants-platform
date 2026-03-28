{{ config(materialized='table') }}

-- Gitcoin 2.0 System Profile
-- Platform-wide aggregate metrics from the March 2026 CSV snapshot

SELECT
    'gitcoin2' as platform,

    -- Grant Pools (Rounds) Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}) as total_grant_pools,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }} WHERE "isOpen"::boolean = true) as active_grant_pools,
    (SELECT COALESCE(SUM("totalGrantPoolSizeInUSD"::numeric), 0) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}) as total_matching_pool_usd,
    (SELECT COALESCE(SUM("co.gitcoin.totalAmountDonatedInUsd"::numeric), 0) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}) as total_donated_via_rounds_usd,
    (SELECT COALESCE(SUM("co.gitcoin.totalDistributed"::numeric), 0) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}) as total_distributed_usd,

    -- Projects Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_projects') }}) as total_projects,

    -- Applications Metrics (populated after silver_gitcoin2_grant_applications is materialized)
    0 as total_applications,
    0 as approved_applications,
    0 as rejected_applications,
    0 as pending_applications,

    -- Donations Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_donations') }}) as total_donations,
    (SELECT COALESCE(SUM("amountInUsd"::numeric), 0) FROM {{ source('silver', 'silver_gitcoin2_donations') }}) as total_donated_usd,
    (SELECT COUNT(DISTINCT "donorAddress") FROM {{ source('silver', 'silver_gitcoin2_donations') }}) as unique_donors,
    (SELECT COALESCE(AVG("amountInUsd"::numeric), 0) FROM {{ source('silver', 'silver_gitcoin2_donations') }}) as avg_donation_usd,

    -- Payouts Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_payouts') }}) as total_payouts,
    (SELECT COALESCE(SUM("amountInUsd"::numeric), 0) FROM {{ source('silver', 'silver_gitcoin2_payouts') }}) as total_paid_out_usd,

    -- Chain Distribution
    (SELECT COUNT(DISTINCT "co.gitcoin.chainId") FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}) as unique_chains,

    -- Funding Mechanism Distribution
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }} WHERE "grantFundingMechanism" = 'Quadratic Funding') as qf_rounds,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }} WHERE "grantFundingMechanism" = 'Direct Grants') as direct_grant_rounds,

    NOW() as calculated_at
