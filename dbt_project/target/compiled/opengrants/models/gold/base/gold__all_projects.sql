--dbt_project/models/gold/base/gold__all_projects.sql

SELECT
  'Giveth' AS source,
  id,
  name,
  description,
  "contentURI",
  "image",
  NULL::FLOAT AS "io.scf.totalAwardedUSD",
  NULL::FLOAT AS "io.scf.totalPaidUSD",
  NULL::TEXT AS "io.scf.auditReportURI",
  NULL::TEXT AS "io.scf.analytics",
  NULL::TEXT AS "io.scf.teamDescription",
  NULL::INT AS "io.scf.submissionsCount",
  NULL::INT AS "io.scf.awardedSubmissionsCount",
  NULL::BOOLEAN AS "io.scf.sorobanUsed",
  NULL::TEXT AS "io.scf.integrationStatus",
  NULL::TEXT AS "io.scf.submissionURLAll",
  NULL::TEXT AS "io.scf.submissionURLAwarded"
FROM "opengrants"."public"."silver_giveth_projects"

UNION ALL

SELECT
  'SCF' AS source,
  id,
  name,
  description,
  "contentURI",
  "image",
  "io.scf.totalAwardedUSD",
  "io.scf.totalPaidUSD",
  "io.scf.auditReportURI",
  "io.scf.analytics",
  "io.scf.teamDescription",
  "io.scf.submissionsCount",
  "io.scf.awardedSubmissionsCount",
  "io.scf.sorobanUsed",
  "io.scf.integrationStatus",
  "io.scf.submissionURLAll",
  "io.scf.submissionURLAwarded"
FROM "opengrants"."public"."silver_scf_projects"