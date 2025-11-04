--dbt_project/models/gold/dashboards/gold__ecosystem_overview.sql
{{ config(materialized='table') }}

-- Cross-ecosystem funding + donations overview.
-- Giveth provides donation metrics; others fallback gracefully.

SELECT
    f.source,
    f.total_pool_size_usd,
    f.avg_pool_size_usd,
    COALESCE(d.total_donations_usd, 0) AS total_donations_usd,
    COALESCE(d.total_projects, 0) AS total_projects,
    COALESCE(d.total_unique_donors, 0) AS total_unique_donors
FROM {{ ref('gold__funding_metrics') }} f
LEFT JOIN
    (
        SELECT
            source,
            SUM(total_donations_usd) AS total_donations_usd,
            SUM(total_projects) AS total_projects,
            SUM(total_unique_donors) AS total_unique_donors
        FROM {{ ref('gold__donation_metrics') }}
        GROUP BY source
    ) d
  ON f.source = d.source
ORDER BY f.total_pool_size_usd DESC;