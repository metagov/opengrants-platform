{{ config(materialized='table') }}

WITH platform_metrics AS (
    -- ENS
    SELECT
        'ens' as platform,
        COUNT(*) as total_projects,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_ens_grant_pools') }}) as total_grant_pools,
        COUNT(*) as total_applications,
        0::numeric as total_funding_usd,
        'Ranked Choice Voting' as primary_mechanism
    FROM {{ source('silver', 'silver_ens_projects') }}

    UNION ALL

    -- Giveth
    SELECT
        'giveth' as platform,
        COUNT(*) as total_projects,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_giveth_grant_pools') }}) as total_grant_pools,
        COUNT(*) as total_applications,  -- Giveth projects = applications
        SUM(COALESCE("io.giveth.totalDonations", 0)) as total_funding_usd,
        'Direct Donations' as primary_mechanism
    FROM {{ source('silver', 'silver_giveth_projects') }}

    UNION ALL

    -- SCF
    SELECT
        'scf' as platform,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_scf_projects') }}) as total_projects,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_scf_grant_pools') }}) as total_grant_pools,
        COUNT(*) as total_applications,
        SUM(COALESCE("fundsApprovedInUSD", 0)) as total_funding_usd,
        'Community Voting' as primary_mechanism
    FROM {{ source('silver', 'silver_scf_grant_applications') }}

    UNION ALL

    -- Privote
    SELECT
        'privote' as platform,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_privote_projects') }}) as total_projects,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_privote_grant_pools') }}) as total_grant_pools,
        COUNT(*) as total_applications,
        SUM(COALESCE("fundsApprovedInUSD", 0)) as total_funding_usd,
        'Quadratic Funding' as primary_mechanism
    FROM {{ source('silver', 'silver_privote_grant_applications') }}

    UNION ALL

    -- Gitcoin 2.0
    -- total_funding_usd = capped matching pool + capped community donations
    -- Excludes 15 outlier donations with astronomical values (raw token amounts, not USD).
    -- Matching pool capped at $5M per round; donations capped at $50K per donation.
    SELECT
        'gitcoin2' as platform,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_projects') }}) as total_projects,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}) as total_grant_pools,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_gitcoin2_grant_applications') }}) as total_applications,
        (
            COALESCE((SELECT SUM(LEAST("totalGrantPoolSizeInUSD"::numeric, 5000000))
                      FROM {{ source('silver', 'silver_gitcoin2_grant_pools') }}
                      WHERE "totalGrantPoolSizeInUSD"::numeric > 0), 0)
            +
            COALESCE((SELECT SUM("amountInUsd")
                      FROM {{ source('silver', 'silver_gitcoin2_donations') }}
                      WHERE "amountInUsd" > 0 AND "amountInUsd" <= 50000), 0)
        ) as total_funding_usd,
        'Quadratic Funding' as primary_mechanism

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