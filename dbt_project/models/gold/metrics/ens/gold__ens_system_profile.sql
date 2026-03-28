{{ config(materialized='table') }}

SELECT
    'ens' as platform,
    COUNT(*) as total_applicants,
    COUNT(DISTINCT "io.ens.proposalId") as total_rounds,
    SUM(CAST("io.ens.score" AS numeric)) as total_voting_power_allocated,
    AVG(CAST("io.ens.score" AS numeric)) as avg_voting_power_per_applicant,
    COUNT(DISTINCT "io.ens.roundType") as distinct_round_types,
    (SELECT COUNT(*) FROM {{ source('silver', 'silver_ens_grant_pools') }}) as total_grant_pools
FROM {{ source('silver', 'silver_ens_projects') }}
WHERE "io.ens.score" IS NOT NULL
