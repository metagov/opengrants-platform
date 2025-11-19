
  
    

  create  table "opengrants"."public"."gold__donation_metrics__dbt_tmp"
  
  
    as
  
  (
    

SELECT
    'giveth' as platform,
    SUM("io.giveth.totalDonations") AS total_donations_usd,
    SUM("io.giveth.totalTraceDonations") AS total_trace_donations,
    SUM("io.giveth.countUniqueDonors") AS total_unique_donors,
    COUNT(*) AS total_projects,
    SUM(CASE WHEN "io.giveth.totalDonations" > 0 THEN 1 ELSE 0 END) AS projects_with_donations,
    SUM(CASE WHEN "io.giveth.totalTraceDonations" > 0 THEN 1 ELSE 0 END) AS projects_with_trace_donations
FROM "opengrants"."public"."silver_giveth_projects"
  );
  