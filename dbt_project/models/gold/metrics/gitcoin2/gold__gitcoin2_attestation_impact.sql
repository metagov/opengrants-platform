{{ config(materialized='table') }}

-- Gitcoin Passport Attestation Impact
-- Compares donation behavior of attested (Passport-verified) vs non-attested donors
-- Attestations table uses co.gitcoin.* namespace; donations uses io.gitcoin2.*

WITH attested_donors AS (
    -- Unique wallet addresses that hold a Gitcoin Passport attestation
    SELECT DISTINCT LOWER(recipient) as donor_address
    FROM {{ source('silver', 'silver_gitcoin2_attestations') }}
    WHERE recipient IS NOT NULL
),

attestation_stats AS (
    -- Aggregate attestation-level metadata per donor
    SELECT
        LOWER(recipient) as donor_address,
        COUNT(*) as attestation_count,
        MAX("co.gitcoin.projectsContributed"::integer) as max_projects_contributed,
        MAX("co.gitcoin.roundsContributed"::integer) as max_rounds_contributed,
        MAX("co.gitcoin.totalUsdAmount"::numeric) as max_total_usd_attested
    FROM {{ source('silver', 'silver_gitcoin2_attestations') }}
    WHERE recipient IS NOT NULL
    GROUP BY LOWER(recipient)
),

donor_behavior AS (
    SELECT
        LOWER(d."donorAddress") as donor_address,
        COUNT(*) as total_donations,
        COUNT(DISTINCT d."grantPoolId") as rounds_donated_to,
        COUNT(DISTINCT d."projectId") as projects_supported,
        COUNT(DISTINCT d."io.gitcoin2.chainId") as chains_donated_on,
        COALESCE(SUM(d."amountInUsd"::numeric), 0) as total_donated_usd,
        COALESCE(AVG(d."amountInUsd"::numeric), 0) as avg_donation_usd,
        COALESCE(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY d."amountInUsd"::numeric), 0) as median_donation_usd
    FROM {{ source('silver', 'silver_gitcoin2_donations') }} d
    GROUP BY LOWER(d."donorAddress")
),

combined AS (
    SELECT
        db.*,
        CASE WHEN ad.donor_address IS NOT NULL THEN true ELSE false END as has_passport,
        ats.attestation_count,
        ats.max_projects_contributed,
        ats.max_rounds_contributed,
        ats.max_total_usd_attested
    FROM donor_behavior db
    LEFT JOIN attested_donors ad ON db.donor_address = ad.donor_address
    LEFT JOIN attestation_stats ats ON db.donor_address = ats.donor_address
)

SELECT
    has_passport,
    COUNT(*) as donor_count,
    ROUND(COUNT(*)::numeric / SUM(COUNT(*)) OVER () * 100, 2) as pct_of_total_donors,

    -- Engagement depth
    ROUND(AVG(total_donations), 2) as avg_donations_count,
    ROUND(AVG(rounds_donated_to), 2) as avg_rounds_donated_to,
    ROUND(AVG(projects_supported), 2) as avg_projects_supported,
    ROUND(AVG(chains_donated_on), 2) as avg_chains_donated_on,

    -- Donation size
    ROUND(AVG(total_donated_usd), 2) as avg_total_donated_usd,
    ROUND(AVG(avg_donation_usd), 4) as avg_single_donation_usd,
    ROUND(AVG(median_donation_usd)::numeric, 4) as avg_median_donation_usd,
    ROUND(PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY total_donated_usd)::numeric, 2) as median_total_donated_usd,

    -- Volume share
    ROUND(SUM(total_donated_usd), 2) as total_donated_usd_segment,
    ROUND(SUM(total_donated_usd) / NULLIF(SUM(SUM(total_donated_usd)) OVER (), 0) * 100, 2) as pct_of_total_volume,

    -- Passport-specific (null for non-attested group)
    ROUND(AVG(attestation_count), 2) as avg_attestation_count,
    ROUND(AVG(max_projects_contributed), 2) as avg_attested_projects_contributed,
    ROUND(AVG(max_rounds_contributed), 2) as avg_attested_rounds_contributed,

    NOW() as calculated_at

FROM combined
GROUP BY has_passport
ORDER BY has_passport DESC
