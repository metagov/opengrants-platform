{{ config(materialized='table') }}

SELECT 
    'privote' as platform,
    COUNT(*) as total_applications,
    SUM("io.privote.votes") as total_votes,
    AVG("io.privote.votes") as avg_votes_per_project,
    MAX("io.privote.votes") as max_votes,
    SUM("fundsApprovedInUSD") as total_funding_distributed_usd,
    AVG("fundsApprovedInUSD") as avg_funding_per_project,
    COUNT(CASE WHEN "io.privote.rank" <= 3 THEN 1 END) as top_3_projects,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_privote_projects') }}) as total_projects,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_privote_grant_pools') }}) as total_grant_pools
FROM {{ source('silver', 'silver_privote_grant_applications') }}