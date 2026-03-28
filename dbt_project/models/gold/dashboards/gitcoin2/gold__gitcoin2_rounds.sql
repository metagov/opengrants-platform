{{ config(materialized='table') }}

-- Per-round summary with QF stats from co.gitcoin extensions
SELECT
    gp.id,
    gp.name,
    gp.description,
    gp."grantFundingMechanism" as funding_mechanism,
    gp."isOpen"::boolean as is_open,
    gp."closeDate" as close_date,
    gp."totalGrantPoolSizeInUSD"::numeric as match_pool_usd,

    -- QF stats (co.gitcoin extensions)
    gp."co.gitcoin.chainId"::integer as chain_id,
    gp."co.gitcoin.totalAmountDonatedInUsd"::numeric as total_donated_usd,
    gp."co.gitcoin.totalDonationsCount"::integer as total_donations_count,
    gp."co.gitcoin.uniqueDonorsCount"::integer as unique_donors_count,
    gp."co.gitcoin.fundedAmountInUsd"::numeric as funded_amount_usd,
    gp."co.gitcoin.matchAmount"::numeric as match_amount,
    gp."co.gitcoin.matchTokenAddress" as match_token_address,
    gp."co.gitcoin.strategyName" as strategy_name,
    gp."co.gitcoin.applicationsStartTime" as applications_start_time,
    gp."co.gitcoin.applicationsEndTime" as applications_end_time,
    gp."co.gitcoin.donationsStartTime" as donations_start_time,
    gp."co.gitcoin.donationsEndTime" as donations_end_time,

    -- Application counts (0 until silver_gitcoin2_grant_applications is materialized)
    0 as total_applications,
    0 as approved_applications

FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }} gp
ORDER BY gp."co.gitcoin.totalAmountDonatedInUsd"::numeric DESC NULLS LAST
