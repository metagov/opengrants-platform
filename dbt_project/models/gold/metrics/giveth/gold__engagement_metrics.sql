{{ config(materialized='table') }}

SELECT
    'giveth' as platform,
    COUNT(*) AS total_projects,
    AVG("io.giveth.qualityScore") AS avg_quality_score,
    SUM("io.giveth.totalReactions") AS total_reactions,
    AVG("io.giveth.totalReactions") AS avg_reactions_per_project,
    COUNT(CASE WHEN "io.giveth.listed" = true THEN 1 END) AS listed_projects
FROM {{ source('silver', 'silver_giveth_projects') }}
WHERE "io.giveth.qualityScore" IS NOT NULL