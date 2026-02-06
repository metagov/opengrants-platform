{{ config(materialized='table') }}

-- Giveth Grant Pools
SELECT
    'giveth' as platform,
    id,
    name,
    description,
    "grantFundingMechanism" as funding_mechanism,
    "isOpen" as is_open,
    "closeDate" as close_date,
    "totalGrantPoolSizeInUSD" as total_pool_size_usd
FROM {{ source('silver', 'silver_giveth_grant_pools') }}

UNION ALL

-- SCF Grant Pools
SELECT
    'scf' as platform,
    id,
    name,
    description,
    "grantFundingMechanism" as funding_mechanism,
    "isOpen"::boolean as is_open,
    "closeDate" as close_date,
    "totalGrantPoolSizeInUSD"::numeric as total_pool_size_usd
FROM {{ source('silver', 'silver_scf_grant_pools') }}

UNION ALL

-- Privote Grant Pools
SELECT
    'privote' as platform,
    id,
    name,
    description,
    "grantFundingMechanism" as funding_mechanism,
    "isOpen"::boolean as is_open,
    "closeDate" as close_date,
    "totalGrantPoolSizeInUSD"::numeric as total_pool_size_usd
FROM {{ source('silver', 'silver_privote_grant_pools') }}

UNION ALL

-- GrantStack (Gitcoin Grants Stack) Grant Pools
SELECT
    'grantsstack' as platform,
    id,
    name,
    description,
    "grantFundingMechanism" as funding_mechanism,
    "isOpen"::boolean as is_open,
    "closeDate" as close_date,
    "totalGrantPoolSizeInUSD"::numeric as total_pool_size_usd
FROM {{ source('silver', 'silver_grantsstack_grant_pools') }}