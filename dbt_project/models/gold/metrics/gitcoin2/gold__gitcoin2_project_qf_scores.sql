{{ config(materialized='table') }}

-- Gitcoin 2.0 Project QF Scores per Round
-- QF formula: matching ∝ (∑ √donation_i)² − ∑ donation_i
-- Breadth of unique donors matters more than total donation size
--
-- Projects + donations use co.gitcoin.* namespace (materialized before rename)
-- Payouts link via applicationId — matching_received will be 0 until
-- silver_gitcoin2_grant_applications is materialized (re-run silver ETL)

WITH project_round_donations AS (
    SELECT
        d."projectId",
        d."grantPoolId",
        COUNT(DISTINCT d."donorAddress") as unique_donors,
        COUNT(*) as donations_count,
        COALESCE(SUM(d."amountInUsd"::numeric), 0) as total_donated_usd,
        COALESCE(AVG(d."amountInUsd"::numeric), 0) as avg_donation_usd,
        COALESCE(MIN(d."amountInUsd"::numeric), 0) as min_donation_usd,
        COALESCE(MAX(d."amountInUsd"::numeric), 0) as max_donation_usd,
        -- QF score estimate using USD amounts as proxy
        -- Actual formula: (SUM(SQRT(amount_in_round_token)))²
        POWER(
            SUM(SQRT(GREATEST(COALESCE(d."amountInUsd"::numeric, 0), 0))),
            2
        ) as qf_score_estimate,
        MIN(d."timestamp") as first_donation_at,
        MAX(d."timestamp") as last_donation_at
    FROM {{ source('silver', 'silver_gitcoin2_donations') }} d
    WHERE d."amountInUsd" <= 50000
    GROUP BY d."projectId", d."grantPoolId"
),

-- Payouts currently can't be linked to projects without grant_applications
-- (payouts have applicationId, not projectId)
-- TODO: join via silver_gitcoin2_grant_applications once materialized
-- Keeping stub so model structure is ready

round_meta AS (
    SELECT
        id as grant_pool_id,
        name as round_name,
        "co.gitcoin.chainId"::integer as chain_id,
        "co.gitcoin.strategyName" as strategy_name,
        "grantFundingMechanism" as funding_mechanism,
        "co.gitcoin.matchAmountInUsd"::numeric as match_pool_usd,
        "co.gitcoin.totalAmountDonatedInUsd"::numeric as round_total_donated_usd
    FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}
    -- Mainnet only, real funded rounds
    WHERE "co.gitcoin.chainId"::integer IN (1, 10, 42, 137, 324, 1088, 1329, 8453, 42161, 42220, 43114, 534352)
      AND "co.gitcoin.fundedAmountInUsd"::numeric >= 100
      AND "co.gitcoin.totalAmountDonatedInUsd"::numeric > 0
),

ranked AS (
    SELECT
        prd.*,
        rm.round_name,
        rm.chain_id,
        rm.strategy_name,
        rm.funding_mechanism,
        rm.match_pool_usd,
        rm.round_total_donated_usd,

        -- QF rank within this round (higher QF score = more matching in QF mechanism)
        RANK() OVER (
            PARTITION BY prd."grantPoolId"
            ORDER BY prd.qf_score_estimate DESC NULLS LAST
        ) as qf_rank_in_round,

        -- Donor breadth rank within this round (more unique donors = higher rank)
        RANK() OVER (
            PARTITION BY prd."grantPoolId"
            ORDER BY prd.unique_donors DESC NULLS LAST
        ) as donor_breadth_rank_in_round,

        -- Volume rank within this round (raw $ donated)
        RANK() OVER (
            PARTITION BY prd."grantPoolId"
            ORDER BY prd.total_donated_usd DESC NULLS LAST
        ) as volume_rank_in_round,

        -- QF advantage: how much higher is QF rank than volume rank?
        -- Positive = project benefits from QF (many donors, smaller amounts)
        -- Negative = project would do better without QF (few large donors)
        RANK() OVER (
            PARTITION BY prd."grantPoolId"
            ORDER BY prd.total_donated_usd DESC NULLS LAST
        ) -
        RANK() OVER (
            PARTITION BY prd."grantPoolId"
            ORDER BY prd.qf_score_estimate DESC NULLS LAST
        ) as qf_advantage_over_volume_rank

    FROM project_round_donations prd
    LEFT JOIN round_meta rm ON rm.grant_pool_id = prd."grantPoolId"
)

SELECT
    r."projectId" as project_id,
    p.name as project_name,
    r."grantPoolId" as grant_pool_id,
    r.round_name,
    r.chain_id,
    r.strategy_name,
    r.funding_mechanism,
    r.match_pool_usd,

    -- QF signals
    r.unique_donors,
    r.donations_count,
    ROUND(r.total_donated_usd::numeric, 2) as total_donated_usd,
    ROUND(r.avg_donation_usd::numeric, 4) as avg_donation_usd,
    ROUND(r.min_donation_usd::numeric, 4) as min_donation_usd,
    ROUND(r.max_donation_usd::numeric, 2) as max_donation_usd,
    ROUND(r.qf_score_estimate::numeric, 4) as qf_score_estimate,

    -- Project's share of the round's total community donations
    ROUND((r.total_donated_usd / NULLIF(r.round_total_donated_usd, 0) * 100)::numeric, 4) as pct_of_round_donations,

    -- Rankings
    r.qf_rank_in_round,
    r.donor_breadth_rank_in_round,
    r.volume_rank_in_round,

    -- QF advantage: +N means QF benefits this project N positions vs pure volume ranking
    r.qf_advantage_over_volume_rank,

    -- Matching received (stub — 0 until grant_applications is materialized)
    -- TODO: JOIN silver_gitcoin2_grant_applications ON projectId + grantPoolId,
    --       then JOIN silver_gitcoin2_payouts ON applicationId
    0::numeric as matching_received_usd,
    0::numeric as matching_leverage_ratio,
    0::numeric as matching_per_donor_usd,

    r.first_donation_at,
    r.last_donation_at,
    NOW() as calculated_at

FROM ranked r
LEFT JOIN {{ source('silver', 'silver_gitcoin2_projects') }} p ON p.id = r."projectId"

-- Exclude micro-donation noise: projects with < $50 total donated in a round
WHERE r.total_donated_usd >= 50

ORDER BY r.qf_score_estimate DESC NULLS LAST
