{{ config(materialized='table') }}

-- Gitcoin 2.0 Round Metrics
-- Per-round analytics with funding, participation, and payout data

SELECT
    gp.id as round_id,
    gp.name as round_name,
    gp."grantFundingMechanism" as funding_mechanism,
    gp."isOpen"::boolean as is_active,
    gp."closeDate" as close_date,
    gp."totalGrantPoolSizeInUSD"::numeric as matching_pool_usd,

    -- Chain info
    gp."io.gitcoin2.chainId" as chain_id,
    gp."io.gitcoin2.strategyName" as strategy_name,

    -- Funding metrics from extensions (pre-aggregated in rounds table)
    COALESCE(gp."io.gitcoin2.totalDonationsCount"::integer, 0) as total_donations_count,
    COALESCE(gp."io.gitcoin2.uniqueDonorsCount"::integer, 0) as unique_donors_count,
    COALESCE(gp."io.gitcoin2.totalAmountDonatedInUsd"::numeric, 0) as total_amount_donated_usd,
    COALESCE(gp."io.gitcoin2.matchAmountInUsd"::numeric, 0) as match_amount_usd,
    COALESCE(gp."io.gitcoin2.fundedAmountInUsd"::numeric, 0) as funded_amount_usd,
    COALESCE(gp."io.gitcoin2.totalDistributed"::numeric, 0) as total_distributed_usd,

    -- Application counts (joined from applications table)
    COALESCE(app_stats.total_applications, 0) as total_applications,
    COALESCE(app_stats.approved_applications, 0) as approved_applications,
    COALESCE(app_stats.rejected_applications, 0) as rejected_applications,
    COALESCE(app_stats.pending_applications, 0) as pending_applications,

    -- Approval rate
    CASE
        WHEN COALESCE(app_stats.total_applications, 0) > 0
        THEN ROUND((COALESCE(app_stats.approved_applications, 0)::numeric / app_stats.total_applications) * 100, 2)
        ELSE 0
    END as approval_rate_pct,

    -- Verified donation stats (from donations table)
    COALESCE(don_stats.donations_count, 0) as verified_donations_count,
    COALESCE(don_stats.donations_total_usd, 0) as verified_donations_usd,
    COALESCE(don_stats.unique_donors, 0) as verified_unique_donors,
    COALESCE(don_stats.avg_donation_usd, 0) as avg_donation_usd,

    -- Payout stats
    COALESCE(pay_stats.payouts_count, 0) as payouts_count,
    COALESCE(pay_stats.payouts_total_usd, 0) as payouts_total_usd,

    -- Timing
    gp."io.gitcoin2.applicationsStartTime" as applications_start,
    gp."io.gitcoin2.applicationsEndTime" as applications_end,
    gp."io.gitcoin2.donationsStartTime" as donations_start,
    gp."io.gitcoin2.donationsEndTime" as donations_end,

    NOW() as calculated_at

FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }} gp

-- Join application stats
LEFT JOIN (
    SELECT
        "io.gitcoin2.roundId_raw" as round_id,
        COUNT(*) as total_applications,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_applications,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_applications,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_applications
    FROM {{ source('silver', 'silver_gitcoin2_grant_applications') }}
    GROUP BY "io.gitcoin2.roundId_raw"
) app_stats ON gp.id LIKE '%' || app_stats.round_id || '%'

-- Join donation stats
LEFT JOIN (
    SELECT
        "io.gitcoin2.roundId_raw" as round_id,
        COUNT(*) as donations_count,
        COALESCE(SUM("amountInUsd"::numeric), 0) as donations_total_usd,
        COUNT(DISTINCT "donorAddress") as unique_donors,
        COALESCE(AVG("amountInUsd"::numeric), 0) as avg_donation_usd
    FROM {{ source('silver', 'silver_gitcoin2_donations') }}
    GROUP BY "io.gitcoin2.roundId_raw"
) don_stats ON gp.id LIKE '%' || don_stats.round_id || '%'

-- Join payout stats
LEFT JOIN (
    SELECT
        "io.gitcoin2.roundId_raw" as round_id,
        COUNT(*) as payouts_count,
        COALESCE(SUM("amountInUsd"::numeric), 0) as payouts_total_usd
    FROM {{ source('silver', 'silver_gitcoin2_payouts') }}
    GROUP BY "io.gitcoin2.roundId_raw"
) pay_stats ON gp.id LIKE '%' || pay_stats.round_id || '%'

ORDER BY gp."totalGrantPoolSizeInUSD"::numeric DESC NULLS LAST
