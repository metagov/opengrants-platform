{{ config(materialized='table') }}

WITH platform_metrics AS (
    -- Giveth
    SELECT 
        'giveth' as platform,
        COUNT(*) as total_projects,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_giveth_grant_pools') }}) as total_grant_pools,
        0 as total_applications,
        SUM("io.giveth.totalDonations") as total_funding_usd,
        'Direct Donations' as primary_mechanism
    FROM {{ source('silver', 'silver_giveth_projects') }}
    
    UNION ALL
    
    -- SCF
    SELECT 
        'scf' as platform,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_scf_projects') }}) as total_projects,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_scf_grant_pools') }}) as total_grant_pools,
        COUNT(*) as total_applications,
        SUM("fundsApprovedInUSD"::numeric) as total_funding_usd,
        'Community Voting' as primary_mechanism
    FROM {{ source('silver', 'silver_scf_grant_applications') }}
    
    UNION ALL
    
    -- Privote
    SELECT 
        'privote' as platform,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_privote_projects') }}) as total_projects,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_privote_grant_pools') }}) as total_grant_pools,
        COUNT(*) as total_applications,
        SUM("fundsApprovedInUSD") as total_funding_usd,
        'Quadratic Funding' as primary_mechanism
    FROM {{ source('silver', 'silver_privote_grant_applications') }}
)

SELECT 
    platform,
    total_projects,
    total_grant_pools,
    total_applications,
    COALESCE(total_funding_usd, 0) as total_funding_usd,
    primary_mechanism,
    ROUND((COALESCE(total_funding_usd, 0) * 100.0 / NULLIF(SUM(COALESCE(total_funding_usd, 0)) OVER(), 0))::numeric, 2) as funding_share_pct
FROM platform_metrics
ORDER BY total_funding_usd DESC NULLS LAST