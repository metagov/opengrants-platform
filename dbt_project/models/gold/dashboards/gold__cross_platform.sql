{{ config(materialized='table') }}

WITH all_projects AS (
    -- Giveth Projects
    SELECT
        'giveth' as platform,
        name,
        LOWER(TRIM(name)) as normalized_name,
        "io.giveth.totalDonations" as total_funding,
        NULL as grant_rounds
    FROM {{ source('silver', 'silver_giveth_projects') }}
    WHERE "io.giveth.totalDonations" > 0

    UNION ALL

    -- SCF Projects
    SELECT
        'scf' as platform,
        ga.name,
        LOWER(TRIM(ga.name)) as normalized_name,
        ga."fundsApprovedInUSD"::numeric as total_funding,
        gp.name as grant_rounds
    FROM {{ source('silver', 'silver_scf_grant_applications') }} ga
    JOIN {{ source('silver', 'silver_scf_grant_pools') }} gp ON ga."grantPoolId" = gp.id
    WHERE ga."fundsApprovedInUSD" IS NOT NULL

    UNION ALL

    -- Privote Projects
    SELECT
        'privote' as platform,
        name,
        LOWER(TRIM(name)) as normalized_name,
        "fundsApprovedInUSD" as total_funding,
        "grantPoolName" as grant_rounds
    FROM {{ source('silver', 'silver_privote_grant_applications') }}
    WHERE "fundsApprovedInUSD" > 0

),

project_cross_presence AS (
    SELECT 
        normalized_name,
        COUNT(DISTINCT platform) as platforms_present,
        STRING_AGG(DISTINCT platform, ', ' ORDER BY platform) as platforms_list,
        COUNT(DISTINCT grant_rounds) as total_grant_rounds,
        SUM(total_funding) as cross_platform_funding,
        MAX(total_funding) as highest_single_funding
    FROM all_projects
    WHERE normalized_name IS NOT NULL AND normalized_name != ''
    GROUP BY normalized_name
    HAVING COUNT(DISTINCT platform) > 1  -- Projects present in multiple platforms
),

project_details AS (
    SELECT
        p.normalized_name,
        p.platforms_present,
        p.platforms_list,
        p.total_grant_rounds,
        p.cross_platform_funding,
        p.highest_single_funding,

        -- Get original project names (take the most common one)
        (SELECT name FROM all_projects ap
         WHERE ap.normalized_name = p.normalized_name
         GROUP BY name ORDER BY COUNT(*) DESC LIMIT 1) as display_name,

        -- Get funding breakdown by platform
        (SELECT SUM(total_funding) FROM all_projects ap
         WHERE ap.normalized_name = p.normalized_name AND ap.platform = 'giveth') as giveth_funding,

        (SELECT SUM(total_funding) FROM all_projects ap
         WHERE ap.normalized_name = p.normalized_name AND ap.platform = 'scf') as scf_funding,

        (SELECT SUM(total_funding) FROM all_projects ap
         WHERE ap.normalized_name = p.normalized_name AND ap.platform = 'privote') as privote_funding

    FROM project_cross_presence p
)

SELECT
    display_name as project_name,
    platforms_present,
    platforms_list,
    total_grant_rounds,
    cross_platform_funding as total_funding_across_platforms,
    highest_single_funding,
    giveth_funding,
    scf_funding,
    privote_funding,

    -- Funding diversity indicator
    CASE
        WHEN (CASE WHEN giveth_funding > 0 THEN 1 ELSE 0 END +
              CASE WHEN scf_funding > 0 THEN 1 ELSE 0 END +
              CASE WHEN privote_funding > 0 THEN 1 ELSE 0 END) >= 3 THEN 'High Diversity'
        WHEN (CASE WHEN giveth_funding > 0 THEN 1 ELSE 0 END +
              CASE WHEN scf_funding > 0 THEN 1 ELSE 0 END +
              CASE WHEN privote_funding > 0 THEN 1 ELSE 0 END) = 2 THEN 'Medium Diversity'
        ELSE 'Low Diversity'
    END as funding_diversity

FROM project_details
ORDER BY cross_platform_funding DESC, platforms_present DESC