{{ config(materialized='table') }}

SELECT
    f.source,
    f.total_funding_usd,
    f.avg_pool_size_usd,
    d.total_donations_usd,
    d.total_projects,
    d.total_unique_donors
FROM {{ ref('gold__funding_metrics') }} f
LEFT JOIN {{ ref('gold__donation_metrics') }} d
  ON f.source = d.source
