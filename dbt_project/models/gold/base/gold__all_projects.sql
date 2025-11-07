{{ config(materialized='view') }}

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
  "relevantTo",
  "licenseURI",
  extensions
FROM {{ source('silver', 'silver_giveth_projects') }}

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
  "relevantTo",
  "licenseURI",
  extensions
FROM {{ source('silver', 'silver_scf_projects') }};
