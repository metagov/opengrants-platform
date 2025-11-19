{{ config(materialized='table') }}

SELECT 
    'scf' as platform,
    COUNT(*) as total_applications,
    SUM("fundsApprovedInUSD"::numeric) as total_funding_distributed_usd,
    AVG("fundsApprovedInUSD"::numeric) as avg_funding_per_project,
    COUNT(DISTINCT "grantPoolId") as active_grant_pools,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_scf_projects') }}) as total_projects,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_scf_grant_pools') }}) as total_grant_pools
FROM {{ source('silver', 'silver_scf_grant_applications') }}
WHERE "fundsApprovedInUSD" IS NOT NULL