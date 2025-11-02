
  create view "opengrants"."public"."gold__all_grant_pools__dbt_tmp"
    
    
  as (
    

SELECT
  'Giveth' AS source,
  *
FROM "opengrants"."public"."silver_giveth_grant_pools"
-- UNION ALL other sources later (scf, celo, gitcoin, etc.)
  );