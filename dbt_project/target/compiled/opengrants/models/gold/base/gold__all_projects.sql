

-- ============================================================
-- Unified DAOIP-5 Projects across ecosystems
-- ============================================================

SELECT
  'Giveth' AS source,
  id,
  name,
  description,
  "contentURI",
  image,
  "coverImage",
  email,
  socials,
  "membersURI",
  "attestationIssuersURI",
  "licenseURI"
FROM "opengrants"."public"."silver_giveth_projects"

UNION ALL

SELECT
  'SCF' AS source,
  id,
  name,
  description,
  "contentURI",
  image,
  "coverImage",
  email,
  socials,
  "membersURI",
  "attestationIssuersURI",
  "licenseURI"
FROM "opengrants"."public"."silver_scf_projects"