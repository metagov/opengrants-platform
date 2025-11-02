
  
    

  create  table "opengrants"."public"."gold__verification_metrics__dbt_tmp"
  
  
    as
  
  (
    

SELECT
    source,
    "io.giveth.verificationStatus" AS verification_status,
    COUNT(*) AS project_count,
    AVG("io.giveth.totalDonations") AS avg_donations,
    AVG("io.giveth.qualityScore") AS avg_quality_score
FROM "opengrants"."public"."gold__all_projects"
GROUP BY 1, 2
ORDER BY project_count DESC
  );
  