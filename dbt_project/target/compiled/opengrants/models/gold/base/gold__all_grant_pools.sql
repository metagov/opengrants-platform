--dbt_project/models/gold/base/gold__all_grant_pools.sql



-- Unified grant pools view with aligned DAOIP-5 fields
SELECT
  'Giveth' AS source,
  id,
  name,
  description,
  "endDate",
  "applicationsURI",
  "totalGrantPoolSizeInUSD",
  "image",
  NULL::TEXT AS "org.stellar.communityfund.phase",
  NULL::FLOAT AS "org.stellar.communityfund.percentAwarded",
  NULL::FLOAT AS "org.stellar.communityfund.totalPaidUSD",
  NULL::FLOAT AS "org.stellar.communityfund.totalPaidXLM",
  NULL::FLOAT AS "org.stellar.communityfund.averageAwardedUSD",
  NULL::INT AS "org.stellar.communityfund.votersNumber",
  NULL::TEXT AS "org.stellar.communityfund.projectPitches",
  NULL::TEXT AS "org.stellar.communityfund.scfVersion",
  NULL::TEXT AS "org.stellar.communityfund.roundRecap",
  NULL::INT AS "org.stellar.communityfund.year",
  NULL::TEXT AS "org.stellar.communityfund.quarterYear",
  NULL::TEXT AS "org.stellar.communityfund.type"
FROM "opengrants"."public"."silver_giveth_grant_pools"

UNION ALL

SELECT
  'SCF' AS source,
  id,
  name,
  description,
  "endDate",
  "applicationsURI",
  "totalGrantPoolSizeInUSD",
  "image",
  "org.stellar.communityfund.phase",
  "org.stellar.communityfund.percentAwarded",
  "org.stellar.communityfund.totalPaidUSD",
  "org.stellar.communityfund.totalPaidXLM",
  "org.stellar.communityfund.averageAwardedUSD",
  "org.stellar.communityfund.votersNumber",
  "org.stellar.communityfund.projectPitches",
  "org.stellar.communityfund.scfVersion",
  "org.stellar.communityfund.roundRecap",
  "org.stellar.communityfund.year",
  "org.stellar.communityfund.quarterYear",
  "org.stellar.communityfund.type"
FROM "opengrants"."public"."silver_scf_grant_pools"