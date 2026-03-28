{{ config(materialized='table') }}

-- Gitcoin 2.0 Chain Metrics
-- Per-chain analytics across all supported blockchains

WITH chain_names AS (
    SELECT * FROM (VALUES
        (1,       'Ethereum Mainnet'),
        (10,      'Optimism'),
        (137,     'Polygon'),
        (250,     'Fantom'),
        (324,     'zkSync Era'),
        (42161,   'Arbitrum One'),
        (42220,   'Celo'),
        (43114,   'Avalanche'),
        (8453,    'Base'),
        (534352,  'Scroll'),
        (7777777, 'Zora'),
        (1329,    'Sei'),
        (34443,   'Mode'),
        (59144,   'Linea'),
        (81457,   'Blast')
    ) AS t(chain_id, chain_name)
),

pool_by_chain AS (
    SELECT
        "co.gitcoin.chainId"::integer as chain_id,
        COUNT(*) as round_count,
        COUNT(*) FILTER (WHERE "isOpen"::boolean = true) as active_rounds,
        COALESCE(SUM("totalGrantPoolSizeInUSD"::numeric), 0) as total_matching_pool_usd,
        COALESCE(SUM("co.gitcoin.matchAmountInUsd"::numeric), 0) as total_match_amount_usd,
        COALESCE(SUM("co.gitcoin.totalAmountDonatedInUsd"::numeric), 0) as total_donated_usd,
        COALESCE(SUM("co.gitcoin.uniqueDonorsCount"::integer), 0) as total_unique_donors,
        COALESCE(SUM("co.gitcoin.totalDonationsCount"::integer), 0) as total_donations_count,
        COALESCE(SUM("co.gitcoin.totalDistributed"::numeric), 0) as total_distributed_usd
    FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}
    GROUP BY "co.gitcoin.chainId"::integer
),

projects_by_chain AS (
    SELECT
        "io.gitcoin2.chainId"::integer as chain_id,
        COUNT(*) as project_count
    FROM {{ source('silver', 'silver_gitcoin2_projects') }}
    GROUP BY "io.gitcoin2.chainId"::integer
),

donations_by_chain AS (
    SELECT
        "io.gitcoin2.chainId"::integer as chain_id,
        COUNT(*) as donation_count,
        COALESCE(SUM("amountInUsd"::numeric), 0) as donation_volume_usd,
        COUNT(DISTINCT "donorAddress") as unique_donors,
        COALESCE(AVG("amountInUsd"::numeric), 0) as avg_donation_usd
    FROM {{ source('silver', 'silver_gitcoin2_donations') }}
    GROUP BY "io.gitcoin2.chainId"::integer
),

payouts_by_chain AS (
    SELECT
        "io.gitcoin2.chainId"::integer as chain_id,
        COUNT(*) as payout_count,
        COALESCE(SUM("amountInUsd"::numeric), 0) as payout_volume_usd
    FROM {{ source('silver', 'silver_gitcoin2_payouts') }}
    GROUP BY "io.gitcoin2.chainId"::integer
)

SELECT
    'gitcoin2' as platform,
    pc.chain_id,
    COALESCE(cn.chain_name, 'Chain ' || pc.chain_id::text) as chain_name,
    COALESCE(pc.round_count, 0) as round_count,
    COALESCE(pc.active_rounds, 0) as active_rounds,
    COALESCE(pc.total_matching_pool_usd, 0) as total_matching_pool_usd,
    COALESCE(pc.total_distributed_usd, 0) as total_distributed_usd,
    COALESCE(pr.project_count, 0) as project_count,
    0 as application_count,
    0 as approved_applications,
    0 as rejected_applications,
    0 as approval_rate_pct,
    COALESCE(dn.donation_count, 0) as donation_count,
    COALESCE(dn.donation_volume_usd, 0) as donation_volume_usd,
    COALESCE(dn.unique_donors, 0) as unique_donors,
    COALESCE(dn.avg_donation_usd, 0) as avg_donation_usd,
    COALESCE(py.payout_count, 0) as payout_count,
    COALESCE(py.payout_volume_usd, 0) as payout_volume_usd,
    COALESCE(dn.donation_volume_usd, 0) + COALESCE(pc.total_matching_pool_usd, 0) as total_funding_volume_usd,
    NOW() as calculated_at

FROM pool_by_chain pc
LEFT JOIN chain_names cn        ON pc.chain_id = cn.chain_id
LEFT JOIN projects_by_chain pr  ON pc.chain_id = pr.chain_id
LEFT JOIN donations_by_chain dn ON pc.chain_id = dn.chain_id
LEFT JOIN payouts_by_chain py   ON pc.chain_id = py.chain_id

ORDER BY COALESCE(dn.donation_volume_usd, 0) + COALESCE(pc.total_matching_pool_usd, 0) DESC
