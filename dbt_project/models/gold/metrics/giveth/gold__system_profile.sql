{{ config(materialized='table') }}

SELECT 
    'giveth' as platform,
    COUNT(*) as total_projects,
    SUM("io.giveth.totalDonations") as total_donations_usd,
    AVG("io.giveth.totalDonations") as avg_donations_per_project,
    SUM("io.giveth.countUniqueDonors") as total_unique_donors,
    COUNT(CASE WHEN "io.giveth.verified" = true THEN 1 END) as verified_projects,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_giveth_grant_pools') }}) as total_grant_pools
FROM {{ source('silver', 'silver_giveth_projects') }}