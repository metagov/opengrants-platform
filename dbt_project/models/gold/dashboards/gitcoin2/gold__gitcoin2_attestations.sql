{{ config(materialized='table') }}

-- Contributor attestations — who attested, how many projects/rounds they contributed to
SELECT
    a.id,
    a.recipient,
    a."refUID" as ref_uid,
    a."timestamp" as attested_at,
    a."contentURI" as metadata_uri,
    a."co.gitcoin.chainId"::integer as chain_id,
    a."co.gitcoin.fee"::numeric as fee,
    a."co.gitcoin.projectsContributed"::integer as projects_contributed,
    a."co.gitcoin.roundsContributed"::integer as rounds_contributed,
    a."co.gitcoin.totalUsdAmount"::numeric as total_usd_amount,
    a."co.gitcoin.chainIdsContributed" as chain_ids_contributed
FROM {{ source('silver', 'silver_gitcoin2_attestations') }} a
ORDER BY a."co.gitcoin.totalUsdAmount"::numeric DESC NULLS LAST
