{{ config(materialized='table') }}

-- Gitcoin 2.0 System Profile
-- Platform-wide aggregate metrics from the March 2026 CSV snapshot

SELECT
    'gitcoin2' as platform,

    -- Grant Pools (Rounds) Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}) as total_grant_pools,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }} WHERE "isOpen"::boolean = true) as active_grant_pools,
    (SELECT COALESCE(SUM("totalGrantPoolSizeInUSD"::numeric), 0) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}) as total_matching_pool_usd,
    (SELECT COALESCE(SUM("io.gitcoin2.totalAmountDonatedInUsd"::numeric), 0) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}) as total_donated_via_rounds_usd,
    (SELECT COALESCE(SUM("io.gitcoin2.totalDistributed"::numeric), 0) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}) as total_distributed_usd,

    -- Projects Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_projects') }}) as total_projects,

    -- Applications Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_applications') }}) as total_applications,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_applications') }} WHERE status = 'approved') as approved_applications,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_applications') }} WHERE status = 'rejected') as rejected_applications,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_applications') }} WHERE status = 'pending') as pending_applications,

    -- Donations Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_donations') }}) as total_donations,
    (SELECT COALESCE(SUM("amountInUsd"::numeric), 0) FROM {{ source('silver', 'silver_gitcoin2_donations') }}) as total_donated_usd,
    (SELECT COUNT(DISTINCT "donorAddress") FROM {{ source('silver', 'silver_gitcoin2_donations') }}) as unique_donors,
    (SELECT COALESCE(AVG("amountInUsd"::numeric), 0) FROM {{ source('silver', 'silver_gitcoin2_donations') }}) as avg_donation_usd,

    -- Payouts Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_payouts') }}) as total_payouts,
    (SELECT COALESCE(SUM("amountInUsd"::numeric), 0) FROM {{ source('silver', 'silver_gitcoin2_payouts') }}) as total_paid_out_usd,

    -- Chain Distribution
    (SELECT COUNT(DISTINCT "io.gitcoin2.chainId") FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}) as unique_chains,

    -- Funding Mechanism Distribution
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }} WHERE "grantFundingMechanism" = 'Quadratic Funding') as qf_rounds,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }} WHERE "grantFundingMechanism" = 'Direct Grants') as direct_grant_rounds,

    NOW() as calculated_at
