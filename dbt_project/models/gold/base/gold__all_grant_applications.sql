{{ config(materialized='table') }}

-- SCF Applications
SELECT 
    'scf' as platform,
    id,
    name as project_name,
    "grantPoolName" as grant_pool_name,
    "projectId" as project_id,
    "grantPoolId" as grant_pool_id,
    "fundsApprovedInUSD"::numeric as funds_approved_usd
FROM {{ source('silver', 'silver_scf_grant_applications') }}

UNION ALL

-- Privote Applications
SELECT 
    'privote' as platform,
    id,
    name as project_name,
    "grantPoolName" as grant_pool_name,
    "projectId" as project_id,
    "grantPoolId" as grant_pool_id,
    "fundsApprovedInUSD" as funds_approved_usd
FROM {{ source('silver', 'silver_privote_grant_applications') }}