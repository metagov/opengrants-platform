{{ config(materialized='table') }}

-- Donations aggregated by round and token for QF analysis
WITH donations_by_round AS (
    SELECT
        d."grantPoolId",
        d."io.gitcoin2.chainId"::integer as chain_id,
        d."io.gitcoin2.tokenAddress" as token_address,
        COUNT(*) as donation_count,
        COUNT(DISTINCT d."donorAddress") as unique_donors,
        COUNT(DISTINCT d."projectId") as projects_receiving,
        SUM(COALESCE(d."amountInUsd"::numeric, 0)) as total_amount_usd,
        AVG(COALESCE(d."amountInUsd"::numeric, 0)) as avg_donation_usd,
        MIN(d."timestamp") as first_donation_at,
        MAX(d."timestamp") as last_donation_at
    FROM {{ source('silver', 'silver_gitcoin2_donations') }} d
    GROUP BY d."grantPoolId", d."io.gitcoin2.chainId", d."io.gitcoin2.tokenAddress"
)

SELECT
    dr.chain_id,
    gp.name as round_name,
    dr."grantPoolId" as grant_pool_id,
    dr.token_address,
    dr.donation_count,
    dr.unique_donors,
    dr.projects_receiving,
    dr.total_amount_usd,
    dr.avg_donation_usd,
    dr.first_donation_at,
    dr.last_donation_at,
    gp."totalGrantPoolSizeInUSD"::numeric as match_pool_usd,
    -- Leverage ratio: how much community raised vs matching pool
    CASE
        WHEN gp."totalGrantPoolSizeInUSD"::numeric > 0
        THEN ROUND(dr.total_amount_usd / gp."totalGrantPoolSizeInUSD"::numeric, 2)
        ELSE NULL
    END as community_leverage_ratio
FROM donations_by_round dr
LEFT JOIN {{ source('silver', 'silver_gitcoin2_grant_pools') }} gp ON gp.id = dr."grantPoolId"
ORDER BY dr.total_amount_usd DESC NULLS LAST
