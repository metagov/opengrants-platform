{{ config(materialized='table') }}

WITH grant_round_timeline AS (
    -- ENS Rounds
    SELECT
        'ens' as platform,
        name as round_name,
        "closeDate" as round_date,
        0::numeric as total_pool_size,
        CAST("io.ens.totalChoices" AS numeric) as projects_funded,
        NULL as avg_funding_per_project
    FROM {{ source('silver', 'silver_ens_grant_pools') }}
    WHERE "closeDate" IS NOT NULL

    UNION ALL

    -- Giveth Rounds
    SELECT
        'giveth' as platform,
        name as round_name,
        "closeDate" as round_date,
        "totalGrantPoolSizeInUSD"::numeric as total_pool_size,
        (SELECT COUNT(*) FROM {{ source('silver', 'silver_giveth_projects') }} WHERE "io.giveth.totalDonations"::numeric > 0) as projects_funded,
        (SELECT AVG("io.giveth.totalDonations"::numeric) FROM {{ source('silver', 'silver_giveth_projects') }} WHERE "io.giveth.totalDonations"::numeric > 0) as avg_funding_per_project
    FROM {{ source('silver', 'silver_giveth_grant_pools') }}
    WHERE "closeDate" IS NOT NULL

    UNION ALL

    -- SCF Rounds
    SELECT
        'scf' as platform,
        gp.name as round_name,
        gp."closeDate" as round_date,
        gp."totalGrantPoolSizeInUSD"::numeric as total_pool_size,
        COUNT(ga.id) as projects_funded,
        AVG(ga."fundsApprovedInUSD"::numeric) as avg_funding_per_project
    FROM {{ source('silver', 'silver_scf_grant_pools') }} gp
    LEFT JOIN {{ source('silver', 'silver_scf_grant_applications') }} ga ON gp.id = ga."grantPoolId"
    WHERE gp."closeDate" IS NOT NULL AND ga."fundsApprovedInUSD" IS NOT NULL
    GROUP BY gp.id, gp.name, gp."closeDate", gp."totalGrantPoolSizeInUSD"

    UNION ALL

    -- Privote Rounds
    SELECT
        'privote' as platform,
        gp.name as round_name,
        gp."closeDate" as round_date,
        gp."totalGrantPoolSizeInUSD"::numeric as total_pool_size,
        COUNT(*) as projects_funded,
        AVG(ga."fundsApprovedInUSD"::numeric) as avg_funding_per_project
    FROM {{ source('silver', 'silver_privote_grant_applications') }} ga
    JOIN {{ source('silver', 'silver_privote_grant_pools') }} gp ON ga."grantPoolId" = gp.id
    WHERE gp."closeDate" IS NOT NULL
    GROUP BY gp.id, gp.name, gp."closeDate", gp."totalGrantPoolSizeInUSD"
),

time_series_data AS (
    SELECT 
        platform,
        round_name,
        round_date::timestamp as round_timestamp,
        total_pool_size,
        projects_funded,
        avg_funding_per_project,
        EXTRACT(YEAR FROM round_date::timestamp) as year,
        EXTRACT(QUARTER FROM round_date::timestamp) as quarter,
        CONCAT(EXTRACT(YEAR FROM round_date::timestamp), '-Q', EXTRACT(QUARTER FROM round_date::timestamp)) as year_quarter
        
    FROM grant_round_timeline
    WHERE round_date IS NOT NULL AND total_pool_size > 0
)

SELECT 
    platform,
    round_name,
    round_timestamp,
    year_quarter,
    total_pool_size,
    projects_funded,
    avg_funding_per_project,
    
    -- Simple growth calculations
    LAG(projects_funded) OVER (PARTITION BY platform ORDER BY round_timestamp) as prev_projects,
    LAG(avg_funding_per_project) OVER (PARTITION BY platform ORDER BY round_timestamp) as prev_avg_funding,
    
    -- Basic efficiency metric
    CASE 
        WHEN projects_funded > 0 THEN total_pool_size / projects_funded
        ELSE 0 
    END as funding_per_project_ratio

FROM time_series_data
ORDER BY platform, round_timestamp