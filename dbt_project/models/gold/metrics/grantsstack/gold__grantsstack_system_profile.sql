{{ config(materialized='table') }}

-- GrantStack (Gitcoin Grants Stack) System Profile
-- Aggregated platform-wide metrics

SELECT
    'grantsstack' as platform,

    -- Grant Pools (Rounds) Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_grantsstack_grant_pools') }}) as total_grant_pools,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_grantsstack_grant_pools') }} WHERE "isOpen"::boolean = true) as active_grant_pools,
    (SELECT COALESCE(SUM("totalGrantPoolSizeInUSD"::numeric), 0) FROM {{ source('silver', 'silver_grantsstack_grant_pools') }}) as total_matching_pool_usd,

    -- Projects Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_grantsstack_projects') }}) as total_projects,

    -- Applications Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_grantsstack_grant_applications') }}) as total_applications,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_grantsstack_grant_applications') }} WHERE status = 'approved') as approved_applications,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_grantsstack_grant_applications') }} WHERE status = 'rejected') as rejected_applications,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_grantsstack_grant_applications') }} WHERE status = 'pending') as pending_applications,

    -- Donations Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_grantsstack_donations') }}) as total_donations,
    (SELECT COALESCE(SUM("amountInUsd"::numeric), 0) FROM {{ source('silver', 'silver_grantsstack_donations') }}) as total_donated_usd,
    (SELECT COUNT(DISTINCT "donorAddress") FROM {{ source('silver', 'silver_grantsstack_donations') }}) as unique_donors,
    (SELECT COALESCE(AVG("amountInUsd"::numeric), 0) FROM {{ source('silver', 'silver_grantsstack_donations') }}) as avg_donation_usd,

    -- Payouts Metrics
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_grantsstack_payouts') }}) as total_payouts,
    (SELECT COALESCE(SUM("amountInUsd"::numeric), 0) FROM {{ source('silver', 'silver_grantsstack_payouts') }}) as total_paid_out_usd,

    -- Chain Distribution (count of unique chains)
    (SELECT COUNT(DISTINCT "io.grantsstack.chainId") FROM {{ source('silver', 'silver_grantsstack_grant_pools') }}) as unique_chains,

    -- Funding Mechanism Distribution
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_grantsstack_grant_pools') }} WHERE "grantFundingMechanism" = 'Quadratic Funding') as qf_rounds,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_grantsstack_grant_pools') }} WHERE "grantFundingMechanism" = 'Direct Grants') as direct_grant_rounds,

    NOW() as calculated_at
