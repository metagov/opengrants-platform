
  
    

  create  table "opengrants"."public"."gold__system_profile__dbt_tmp"
  
  
    as
  
  (
    

SELECT
    p.source,
    v.verification_status,
    v.project_count,
    v.avg_quality_score,
    e.engagement_tier,
    e.avg_donations,
    e.avg_donors
FROM "opengrants"."public"."gold__verification_metrics" v
LEFT JOIN "opengrants"."public"."gold__engagement_metrics" e
  ON v.source = e.source
LEFT JOIN "opengrants"."public"."gold__all_projects" p
  ON v.source = p.source
GROUP BY
    p.source,
    v.verification_status,
    v.project_count,
    v.avg_quality_score,
    e.engagement_tier,
    e.avg_donations,
    e.avg_donors
  );
  