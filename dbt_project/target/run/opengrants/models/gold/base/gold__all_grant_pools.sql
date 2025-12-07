
  
    

  create  table "defaultdb"."public"."gold__all_grant_pools__dbt_tmp"
  
  
    as
  
  (
    

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
FROM "defaultdb"."public"."silver_giveth_grant_pools"

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
FROM "defaultdb"."public"."silver_scf_grant_pools"

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
FROM "defaultdb"."public"."silver_privote_grant_pools"
  );
  