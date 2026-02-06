{{ config(materialized='table') }}

-- GrantStack Payout Metrics
-- Tracks matching fund distributions to projects

WITH payout_stats AS (
    SELECT
        COUNT(*) as total_payouts,
        COALESCE(SUM("amountInUsd"::numeric), 0) as total_paid_usd,
        COUNT(DISTINCT "applicationId") as applications_paid,
        COUNT(DISTINCT "grantPoolId") as rounds_with_payouts,
        COALESCE(AVG("amountInUsd"::numeric), 0) as avg_payout_usd,
        COALESCE(MIN("amountInUsd"::numeric), 0) as min_payout_usd,
        COALESCE(MAX("amountInUsd"::numeric), 0) as max_payout_usd,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "amountInUsd"::numeric), 0) as median_payout_usd
    FROM {{ source('silver', 'silver_grantsstack_payouts') }}
),

payout_by_sender AS (
    SELECT
        COUNT(DISTINCT sender) as unique_senders,
        COALESCE(AVG(sender_payout_count), 0) as avg_payouts_per_sender,
        COALESCE(MAX(sender_payout_count), 0) as max_payouts_by_sender
    FROM (
        SELECT
            sender,
            COUNT(*) as sender_payout_count
        FROM {{ source('silver', 'silver_grantsstack_payouts') }}
        GROUP BY sender
    ) sender_stats
),

chain_distribution AS (
    SELECT
        COUNT(DISTINCT "io.grantsstack.chainId") as chains_with_payouts
    FROM {{ source('silver', 'silver_grantsstack_payouts') }}
),

token_distribution AS (
    SELECT
        COUNT(DISTINCT "tokenAddress") as unique_tokens_used
    FROM {{ source('silver', 'silver_grantsstack_payouts') }}
),

-- Compare payouts to total donations
funding_efficiency AS (
    SELECT
        COALESCE(SUM(p."amountInUsd"::numeric), 0) as total_payouts_usd,
        COALESCE((SELECT SUM("amountInUsd"::numeric) FROM {{ source('silver', 'silver_grantsstack_donations') }}), 0) as total_donations_usd,
        COALESCE((SELECT SUM("totalGrantPoolSizeInUSD"::numeric) FROM {{ source('silver', 'silver_grantsstack_grant_pools') }}), 0) as total_matching_pool_usd
    FROM {{ source('silver', 'silver_grantsstack_payouts') }} p
)

SELECT
    'grantsstack' as platform,

    -- Volume Metrics
    ps.total_payouts,
    ps.total_paid_usd,
    ps.applications_paid,
    ps.rounds_with_payouts,

    -- Payout Size Distribution
    ps.avg_payout_usd,
    ps.min_payout_usd,
    ps.max_payout_usd,
    ps.median_payout_usd,

    -- Sender Metrics
    pbs.unique_senders,
    pbs.avg_payouts_per_sender,
    pbs.max_payouts_by_sender,

    -- Distribution Metrics
    cd.chains_with_payouts,
    td.unique_tokens_used,

    -- Funding Efficiency
    fe.total_payouts_usd,
    fe.total_donations_usd,
    fe.total_matching_pool_usd,
    fe.total_donations_usd + fe.total_matching_pool_usd as total_funding_available_usd,
    CASE
        WHEN fe.total_matching_pool_usd > 0
        THEN ROUND((fe.total_payouts_usd / fe.total_matching_pool_usd) * 100, 2)
        ELSE 0
    END as matching_distribution_rate_pct,

    NOW() as calculated_at

FROM payout_stats ps
CROSS JOIN payout_by_sender pbs
CROSS JOIN chain_distribution cd
CROSS JOIN token_distribution td
CROSS JOIN funding_efficiency fe
