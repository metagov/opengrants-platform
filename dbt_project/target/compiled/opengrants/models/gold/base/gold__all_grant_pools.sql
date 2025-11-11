

-- ============================================================
-- Unified DAOIP-5 Grant Pools across ecosystems
-- ============================================================

SELECT
  'Giveth' AS source,
  id,
  name,
  description,
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
  "totalGrantPoolSize"
FROM "opengrants"."public"."silver_giveth_grant_pools"

UNION ALL

SELECT
  'SCF' AS source,
  id,
  name,
  description,
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
  "totalGrantPoolSize"
FROM "opengrants"."public"."silver_scf_grant_pools"