
  create view "opengrants"."public"."gold__all_projects__dbt_tmp"
    
    
  as (
    

SELECT
  'Giveth' AS source,
  *
FROM "opengrants"."public"."silver_giveth_projects"
-- UNION ALL other sources later (scf, celo, gitcoin, etc.)
  );