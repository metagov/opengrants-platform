{{ config(materialized='view') }}

-- ============================================================
-- Unified DAOIP-5 Grant Pools across ecosystems
-- ============================================================

SELECT
  'Giveth' AS source,
  id,
  name,
  description,
  applicationsURI,
  "totalGrantPoolSizeInUSD",
  "isOpen",
  "closeDate",
  "image",
  "coverImage",
  "email",
  "grantFundingMechanism",
  "governanceURI",
  "attestationIssuersURI",
  "requiredCredentials",
  "totalGrantPoolSize",
  extensions
FROM {{ source('silver', 'silver_giveth_grant_pools') }}

UNION ALL

SELECT
  'SCF' AS source,
  id,
  name,
  description,
  applicationsURI,
  "totalGrantPoolSizeInUSD",
  "isOpen",
  "closeDate",
  "image",
  "coverImage",
  "email",
  "grantFundingMechanism",
  "governanceURI",
  "attestationIssuersURI",
  "requiredCredentials",
  "totalGrantPoolSize",
  extensions
FROM {{ source('silver', 'silver_scf_grant_pools') }};
