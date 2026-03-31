{{ config(materialized='table') }}

-- Gitcoin 2.0 Token Flow Analysis
-- Which tokens move through the protocol on each chain
-- Donations table uses co.gitcoin.* namespace (materialized before rename)

WITH known_tokens AS (
    SELECT * FROM (VALUES
        ('0x0000000000000000000000000000000000000000', 'ETH'),
        ('0x4200000000000000000000000000000000000042', 'OP'),
        ('0x833589fcd6edb6e08f4c7c32d4f71b54bda02913', 'USDC'),
        ('0xd9aaec86b65d86f6a7b5b1b0c42ffa531710b6ca', 'USDbC'),
        ('0x0b2c639c533813f4aa9d7837caf62653d097ff85', 'USDC.e'),
        ('0x7f5c764cbc14f9669b88837ca1490cca17c31607', 'USDC'),
        ('0xaf88d065e77c8cc2239327c5edb3a432268e5831', 'USDC'),
        ('0xda10009cbd5d07dd0cecc66161fc93d7c9000da1', 'DAI'),
        ('0x50c5725949a6f0c72e6c4a641f24049a917db0cb', 'DAI'),
        ('0x4ed4e862860bed51a9570b96d89af5e1b0efefed', 'DEGEN'),
        ('0x940181a94a35a4569e4529a3cdfb74e38fd98631', 'AERO'),
        ('0x765de816845861e75a25fca122bb6898b8b1282a', 'cUSD'),
        ('0x471ece3750da237f93b8e339c536989b8978a438', 'CELO'),
        ('0x2791bca1f2de4661ed88a30c99a7a9449aa84174', 'USDC'),
        ('0x3c499c542cef5e3811e1192ce70d8cc03d5c3359', 'USDC'),
        ('0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee', 'ETH')
    ) AS t(address, symbol)
),

chain_names AS (
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

token_stats AS (
    SELECT
        "co.gitcoin.chainId"::integer as chain_id,
        LOWER("co.gitcoin.tokenAddress") as token_address,
        COUNT(*) as donation_count,
        COALESCE(SUM("amountInUsd"::numeric), 0) as total_donated_usd,
        COUNT(DISTINCT "donorAddress") as unique_donors,
        COUNT(DISTINCT "grantPoolId") as rounds_using_token,
        COUNT(DISTINCT "projectId") as projects_receiving,
        COALESCE(AVG("amountInUsd"::numeric), 0) as avg_donation_usd,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY "amountInUsd"::numeric)::numeric, 0) as median_donation_usd
    FROM {{ source('silver', 'silver_gitcoin2_donations') }}
    WHERE "co.gitcoin.tokenAddress" IS NOT NULL
      AND "co.gitcoin.tokenAddress" != ''
      AND "amountInUsd" <= 50000
    GROUP BY
        "co.gitcoin.chainId"::integer,
        LOWER("co.gitcoin.tokenAddress")
),

chain_totals AS (
    SELECT chain_id, SUM(total_donated_usd) as chain_total_usd
    FROM token_stats
    GROUP BY chain_id
)

SELECT
    ts.chain_id,
    COALESCE(cn.chain_name, 'Chain ' || ts.chain_id::text) as chain_name,
    ts.token_address,
    COALESCE(kt.symbol, 'UNKNOWN') as token_symbol,
    ts.donation_count,
    ROUND(ts.total_donated_usd::numeric, 2) as total_donated_usd,
    ts.unique_donors,
    ts.rounds_using_token,
    ts.projects_receiving,
    ROUND(ts.avg_donation_usd::numeric, 4) as avg_donation_usd,
    ROUND(ts.median_donation_usd::numeric, 4) as median_donation_usd,
    ROUND((ts.total_donated_usd / NULLIF(ct.chain_total_usd, 0) * 100)::numeric, 2) as pct_of_chain_volume,
    ROUND(ct.chain_total_usd::numeric, 2) as chain_total_usd,
    NOW() as calculated_at

FROM token_stats ts
LEFT JOIN known_tokens kt ON ts.token_address = kt.address
LEFT JOIN chain_names cn ON ts.chain_id = cn.chain_id
LEFT JOIN chain_totals ct ON ts.chain_id = ct.chain_id

ORDER BY ts.total_donated_usd DESC
