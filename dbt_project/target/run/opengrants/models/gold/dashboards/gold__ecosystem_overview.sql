
  
    

  create  table "defaultdb"."public"."gold__ecosystem_overview__dbt_tmp"
  
  
    as
  
  (
    

WITH platform_metrics AS (
    -- Giveth
    SELECT 
        'giveth' as platform,
        COUNT(*) as total_projects,
        (SELECT COUNT(*) FROM "defaultdb"."public"."silver_giveth_grant_pools") as total_grant_pools,
        COUNT(*) as total_applications,  -- Fixed: Giveth projects = applications
        SUM(COALESCE("io.giveth.totalDonations", 0)) as total_funding_usd,
        'Direct Donations' as primary_mechanism
    FROM "defaultdb"."public"."silver_giveth_projects"
    
    UNION ALL
    
    -- SCF
    SELECT 
        'scf' as platform,
        (SELECT COUNT(*) FROM "defaultdb"."public"."silver_scf_projects") as total_projects,
        (SELECT COUNT(*) FROM "defaultdb"."public"."silver_scf_grant_pools") as total_grant_pools,
        COUNT(*) as total_applications,
        SUM(COALESCE("fundsApprovedInUSD"::numeric, 0)) as total_funding_usd,  -- Fixed: Handle NULL values
        'Community Voting' as primary_mechanism
    FROM "defaultdb"."public"."silver_scf_grant_applications"
    
    UNION ALL
    
    -- Privote
    SELECT 
        'privote' as platform,
        (SELECT COUNT(*) FROM "defaultdb"."public"."silver_privote_projects") as total_projects,
        (SELECT COUNT(*) FROM "defaultdb"."public"."silver_privote_grant_pools") as total_grant_pools,
        COUNT(*) as total_applications,
        SUM(COALESCE("fundsApprovedInUSD", 0)) as total_funding_usd,
        'Quadratic Funding' as primary_mechanism
    FROM "defaultdb"."public"."silver_privote_grant_applications"
)

SELECT 
    platform,
    total_projects,
    total_grant_pools,
    total_applications,
    total_funding_usd,
    CASE 
        WHEN total_funding_usd = 0 THEN 'N/A'
        ELSE '$' || ROUND(total_funding_usd / 1000) || 'K'
    END as total_funding_display,
    primary_mechanism,
    ROUND((total_funding_usd * 100.0 / NULLIF(SUM(total_funding_usd) OVER(), 0))::numeric, 2) as funding_share_pct
FROM platform_metrics
ORDER BY total_funding_usd DESC NULLS LAST
  );
  