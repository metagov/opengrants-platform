{{ config(materialized='table') }}

WITH project_funding_history AS (
    -- Combine all project funding across platforms
    SELECT 
        LOWER(TRIM(name)) as normalized_name,
        platform,
        total_funding,
        grant_round,
        funding_date
    FROM (
        -- ENS (treat each round as a separate grant)
        SELECT
            name,
            'ens' as platform,
            NULL as total_funding,
            "io.ens.proposalTitle" as grant_round,
            TO_TIMESTAMP(CAST("io.ens.endTs" AS double precision)) as funding_date
        FROM {{ source('silver', 'silver_ens_projects') }}
        WHERE "io.ens.score" IS NOT NULL

        UNION ALL

        -- Giveth (treat as single round)
        SELECT
            name,
            'giveth' as platform,
            "io.giveth.totalDonations" as total_funding,
            'Giveth General' as grant_round,
            CURRENT_DATE as funding_date
        FROM {{ source('silver', 'silver_giveth_projects') }}
        WHERE "io.giveth.totalDonations" > 0
        
        UNION ALL
        
        -- SCF
        SELECT 
            ga.name,
            'scf' as platform, 
            ga."fundsApprovedInUSD" as total_funding,
            gp.name as grant_round,
            gp."closeDate"::timestamp as funding_date
        FROM {{ source('silver', 'silver_scf_grant_applications') }} ga
        JOIN {{ source('silver', 'silver_scf_grant_pools') }} gp ON ga."grantPoolId" = gp.id
        WHERE ga."fundsApprovedInUSD" IS NOT NULL
        
        UNION ALL
        
        -- Privote
        SELECT
            name,
            'privote' as platform,
            "fundsApprovedInUSD" as total_funding,
            "grantPoolName" as grant_round,
            "createdAt"::timestamp as funding_date
        FROM {{ source('silver', 'silver_privote_grant_applications') }}
        WHERE "fundsApprovedInUSD" > 0

        UNION ALL

        -- Gitcoin 2.0
        SELECT
            ga.name,
            'gitcoin2' as platform,
            ga."fundsApprovedInUSD" as total_funding,
            gp.name as grant_round,
            gp."closeDate"::timestamp as funding_date
        FROM {{ source('silver', 'silver_gitcoin2_grant_applications') }} ga
        JOIN {{ source('silver', 'silver_gitcoin2_grant_pools') }} gp ON ga."grantPoolId" = gp.id
        WHERE ga."fundsApprovedInUSD" IS NOT NULL
    ) combined
),

project_round_sequence AS (
    SELECT 
        normalized_name,
        platform,
        grant_round,
        funding_date,
        total_funding,
        ROW_NUMBER() OVER (PARTITION BY normalized_name, platform ORDER BY funding_date) as funding_round_number,
        COUNT(*) OVER (PARTITION BY normalized_name, platform) as total_rounds_funded
    FROM project_funding_history
    WHERE normalized_name IS NOT NULL AND normalized_name != ''
),

funding_categories AS (
    SELECT 
        CASE 
            WHEN total_rounds_funded = 1 THEN 'New Projects'
            ELSE 'Repeat-Funded Projects'
        END as funding_category,
        
        normalized_name,
        platform,
        total_funding,
        funding_round_number,
        total_rounds_funded,
        grant_round,
        funding_date
    FROM project_round_sequence
),

category_summary AS (
    SELECT 
        funding_category,
        COUNT(DISTINCT normalized_name) as project_count,
        SUM(total_funding) as total_funding,
        AVG(total_funding) as avg_funding_per_project,
        COUNT(*) as total_grants_received
    FROM funding_categories
    GROUP BY funding_category
),

summary_totals AS (
    SELECT 
        SUM(total_funding) as grand_total_funding
    FROM category_summary
)

SELECT 
    -- Overall Summary
    cs_new.project_count as new_projects_count,
    cs_new.total_funding as new_projects_funding,
    cs_repeat.project_count as repeat_projects_count,
    cs_repeat.total_funding as repeat_projects_funding,
    
    -- Simple percentage calculation without complex ROUND
    CASE 
        WHEN st.grand_total_funding > 0 THEN
            (cs_new.total_funding * 100.0 / st.grand_total_funding)
        ELSE 0
    END as new_projects_funding_pct,
    
    CASE 
        WHEN st.grand_total_funding > 0 THEN
            (cs_repeat.total_funding * 100.0 / st.grand_total_funding)
        ELSE 0
    END as repeat_projects_funding_pct,
    
    -- Additional insights
    cs_new.avg_funding_per_project as new_projects_avg_funding,
    cs_repeat.avg_funding_per_project as repeat_projects_avg_funding,
    cs_new.total_grants_received as new_projects_total_grants,
    cs_repeat.total_grants_received as repeat_projects_total_grants

FROM category_summary cs_new
CROSS JOIN category_summary cs_repeat
CROSS JOIN summary_totals st
WHERE cs_new.funding_category = 'New Projects'
AND cs_repeat.funding_category = 'Repeat-Funded Projects'