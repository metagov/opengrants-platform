{{ config(materialized='table') }}

-- ENS Grant Pools
SELECT
    'ens' as platform,
    id,
    name,
    description,
    "grantFundingMechanism" as funding_mechanism,
    "isOpen"::boolean as is_open,
    "closeDate" as close_date,
    "totalGrantPoolSizeInUSD"::numeric as total_pool_size_usd
FROM {{ source('silver', 'silver_ens_grant_pools') }}

UNION ALL

-- Giveth Grant Pools
SELECT
    'giveth' as platform,
    id,
    name,
    description,
    "grantFundingMechanism" as funding_mechanism,
    "isOpen"::boolean as is_open,
    "closeDate" as close_date,
    "totalGrantPoolSizeInUSD"::numeric as total_pool_size_usd
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

