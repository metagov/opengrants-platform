{{ config(materialized='table') }}

SELECT
    p.source,
    v.verification_status,
    v.project_count,
    v.avg_quality_score,
    e.engagement_tier,
    e.avg_donations,
    e.avg_donors
FROM {{ ref('gold__verification_metrics') }} v
LEFT JOIN {{ ref('gold__engagement_metrics') }} e
  ON v.source = e.source
LEFT JOIN {{ ref('gold__all_projects') }} p
  ON v.source = p.source
GROUP BY
    p.source,
    v.verification_status,
    v.project_count,
    v.avg_quality_score,
    e.engagement_tier,
    e.avg_donations,
    e.avg_donors