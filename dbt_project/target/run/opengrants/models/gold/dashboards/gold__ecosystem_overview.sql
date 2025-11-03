
  
    

  create  table "opengrants"."public"."gold__ecosystem_overview__dbt_tmp"
  
  
    as
  
  (
    

SELECT
    f.source,
    f.total_pool_size_usd,
    f.avg_pool_size_usd,
    d.total_donations_usd,
    d.total_projects,
    d.total_unique_donors
FROM "opengrants"."public"."gold__funding_metrics" f
LEFT JOIN "opengrants"."public"."gold__donation_metrics" d
  ON f.source = d.source
  );
  