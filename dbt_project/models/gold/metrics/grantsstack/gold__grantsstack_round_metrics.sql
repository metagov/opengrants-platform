{{ config(materialized='table') }}

-- GrantStack Round (Grant Pool) Metrics
-- Per-round analytics with funding and participation data

SELECT
    gp.id as round_id,
    gp.name as round_name,
    gp."grantFundingMechanism" as funding_mechanism,
    gp."isOpen"::boolean as is_active,
    gp."closeDate" as close_date,
    gp."totalGrantPoolSizeInUSD"::numeric as matching_pool_usd,

    -- Chain info
    gp."io.grantsstack.chainId" as chain_id,
    gp."io.grantsstack.strategyName" as strategy_name,

    -- Application metrics (from extensions)
    COALESCE(gp."io.grantsstack.totalDonationsCount"::integer, 0) as total_donations_count,
    COALESCE(gp."io.grantsstack.uniqueDonorsCount"::integer, 0) as unique_donors_count,
    COALESCE(gp."io.grantsstack.totalAmountDonatedInUsd"::numeric, 0) as total_amount_donated_usd,
    COALESCE(gp."io.grantsstack.matchAmountInUsd"::numeric, 0) as match_amount_usd,
    COALESCE(gp."io.grantsstack.fundedAmountInUsd"::numeric, 0) as funded_amount_usd,

    -- Application counts (joined from applications)
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

    -- Donation stats from donations table
    COALESCE(don_stats.donations_count, 0) as verified_donations_count,
    COALESCE(don_stats.donations_total_usd, 0) as verified_donations_usd,
    COALESCE(don_stats.unique_donors, 0) as verified_unique_donors,
    COALESCE(don_stats.avg_donation_usd, 0) as avg_donation_usd,

    -- Payout stats
    COALESCE(pay_stats.payouts_count, 0) as payouts_count,
    COALESCE(pay_stats.payouts_total_usd, 0) as payouts_total_usd,

    -- Timing (from extensions)
    gp."io.grantsstack.applicationsStartTime" as applications_start,
    gp."io.grantsstack.applicationsEndTime" as applications_end,
    gp."io.grantsstack.donationsStartTime" as donations_start,
    gp."io.grantsstack.donationsEndTime" as donations_end,

    NOW() as calculated_at

FROM {{ source('silver', 'silver_grantsstack_grant_pools') }} gp

-- Join application stats
LEFT JOIN (
    SELECT
        "io.grantsstack.roundId_raw" as round_id,
        COUNT(*) as total_applications,
        COUNT(*) FILTER (WHERE status = 'approved') as approved_applications,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected_applications,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_applications
    FROM {{ source('silver', 'silver_grantsstack_grant_applications') }}
    GROUP BY "io.grantsstack.roundId_raw"
) app_stats ON gp.id LIKE '%' || app_stats.round_id || '%'

-- Join donation stats
LEFT JOIN (
    SELECT
        "io.grantsstack.roundId_raw" as round_id,
        COUNT(*) as donations_count,
        COALESCE(SUM("amountInUsd"::numeric), 0) as donations_total_usd,
        COUNT(DISTINCT "donorAddress") as unique_donors,
        COALESCE(AVG("amountInUsd"::numeric), 0) as avg_donation_usd
    FROM {{ source('silver', 'silver_grantsstack_donations') }}
    GROUP BY "io.grantsstack.roundId_raw"
) don_stats ON gp.id LIKE '%' || don_stats.round_id || '%'

-- Join payout stats
LEFT JOIN (
    SELECT
        "io.grantsstack.roundId_raw" as round_id,
        COUNT(*) as payouts_count,
        COALESCE(SUM("amountInUsd"::numeric), 0) as payouts_total_usd
    FROM {{ source('silver', 'silver_grantsstack_payouts') }}
    GROUP BY "io.grantsstack.roundId_raw"
) pay_stats ON gp.id LIKE '%' || pay_stats.round_id || '%'

ORDER BY gp."totalGrantPoolSizeInUSD"::numeric DESC NULLS LAST
