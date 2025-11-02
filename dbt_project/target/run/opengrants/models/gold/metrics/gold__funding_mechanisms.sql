
  
    

  create  table "opengrants"."public"."gold__funding_mechanisms__dbt_tmp"
  
  
    as
  
  (
    

SELECT
    source,
    "grantFundingMechanism" AS funding_mechanism,
    COUNT(*) AS rounds_count,
    SUM("totalGrantPoolSizeInUSD") AS total_funding,
    AVG("totalGrantPoolSizeInUSD") AS avg_funding
FROM "opengrants"."public"."gold__all_grant_pools"
GROUP BY 1, 2
ORDER BY total_funding DESC
  );
  