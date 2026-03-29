{{ config(materialized='table') }}

-- Projects with aggregated funding across all rounds they participated in
-- Note: project_funding CTE will be populated after silver_gitcoin2_grant_applications is materialized
-- Projects table uses co.gitcoin.* namespace (materialized before rename)

SELECT
    p.id,
    p.name,
    p.description,
    p."contentURI" as content_uri,
    p."image" as image_url,
    p."co.gitcoin.chainId"::integer as chain_id,
    p."co.gitcoin.projectType" as project_type,
    p."co.gitcoin.anchorAddress" as anchor_address,
    0 as rounds_participated,
    0 as total_funds_approved_usd,
    0 as total_donated_usd,
    0 as total_donations_count,
    0 as total_unique_donors,
    NULL::timestamp as last_application_date,
    NULL::text as application_statuses

FROM {{ source('silver', 'silver_gitcoin2_projects') }} p
ORDER BY p.name
