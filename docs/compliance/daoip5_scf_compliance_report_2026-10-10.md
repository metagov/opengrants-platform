# DAOIP-5 Compliance Report
**Generated:** 2026-10-10
**Sources assessed:** scf
**Methodology:** `docs/compliance/daoip5_assessment_methodology.md`

> **How to read this report.** This is the field-level check of the SCF schema map. The result
> that matters is the required fields: **all 14 DAOIP-5 required fields are backed by source data,
> with no fabricated values (0 P0).** The 62% below counts *all* fields, including optional ones
> SCF doesn't record, so it is not a compliance rate. The headline compliance metric is
> round-level: 100% of finished SCF rounds indexed in DAOIP-5 (March 2026 report), re-confirmed
> for SCF #42–#45 with `scripts/daoip5_round_compliance.py` after PR #3 is deployed.

## Summary

| Source | Grant Pools | Projects | Grant Applications | Overall | P0 |
|--------|-------------|----------|--------------------|---------|-----|
| **scf** | 67% | 50% | 65% | **62%** | 0 |

_Column-backed % = (SOURCE_MAPPED + COMPUTED fields) ÷ total fields. Measures the fraction of DAOIP-5 fields that carry forward information from the underlying source system. HARDCODED and NULL fields are excluded._

---

## SCF — Stellar Community Fund (Airtable API)
**Schema version:** 1.0.12 | **Last updated:** 2025-11-20T00:00:00Z
**Schema map:** `og_dagster/configs/schema_maps/active/daoip5_scf.yaml`

### Grant Pools
**Column-backed fields:** 67% | **Weighted score:** 81%

| Field | Required | Category | Points | Notes |
|-------|----------|----------|--------|-------|
| `id` | **YES** | SOURCE_MAPPED | 3/3 | `Name` |
| `name` | **YES** | SOURCE_MAPPED | 3/3 | `Name` |
| `description` | **YES** | SOURCE_MAPPED | 3/3 | `Description` |
| `applicationsURI` | opt | SOURCE_MAPPED | 1/1 | `Round URL` |
| `totalGrantPoolSizeInUSD` | **YES** | SOURCE_MAPPED | 3/3 | `Total Awarded (USD)` |
| `isOpen` | **YES** | SOURCE_MAPPED | 3/3 | `Submission Close Date` |
| `closeDate` | opt | SOURCE_MAPPED | 1/1 | `Submission Close Date` |
| `image` | opt | SOURCE_MAPPED | 1/1 | `Image` |
| `coverImage` | opt | HARDCODED | 0/1 | hardcoded |
| `email` | opt | HARDCODED | 0/1 | hardcoded |
| `grantFundingMechanism` | **YES** | SOURCE_MAPPED | 3/3 | `Type` |
| `governanceURI` | opt | HARDCODED | 0/1 | hardcoded |
| `attestationIssuersURI` | opt | HARDCODED | 0/1 | hardcoded |
| `requiredCredentials` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `totalGrantPoolSize` | opt | SOURCE_MAPPED | 1/1 | `Total Awarded (USD)` |

### Projects
**Column-backed fields:** 50% | **Weighted score:** 70%

| Field | Required | Category | Points | Notes |
|-------|----------|----------|--------|-------|
| `id` | **YES** | SOURCE_MAPPED | 3/3 | `Title` |
| `name` | **YES** | SOURCE_MAPPED | 3/3 | `Title` |
| `description` | **YES** | SOURCE_MAPPED | 3/3 | `Description` |
| `contentURI` | **YES** | SOURCE_MAPPED | 3/3 | `Website` |
| `image` | opt | SOURCE_MAPPED | 1/1 | `Thumbnail` |
| `coverImage` | opt | HARDCODED | 0/1 | hardcoded |
| `email` | opt | HARDCODED | 0/1 | hardcoded |
| `socials` | opt | COMPUTED | 1/1 |  |
| `membersURI` | opt | HARDCODED | 0/1 | hardcoded |
| `attestationIssuersURI` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `relevantTo` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `licenseURI` | opt | HARDCODED | 0/1 | hardcoded |

### Grant Applications
**Column-backed fields:** 65% | **Weighted score:** 75%

| Field | Required | Category | Points | Notes |
|-------|----------|----------|--------|-------|
| `id` | **YES** | SOURCE_MAPPED | 3/3 | `Submission / Project` |
| `name` | opt | SOURCE_MAPPED | 1/1 | `Submission Title` |
| `grantPoolName` | opt | SOURCE_MAPPED | 1/1 | `Round` |
| `createdAt` | **YES** | SOURCE_MAPPED | 3/3 | `_airtable_created_time` |
| `description` | opt | SOURCE_MAPPED | 1/1 | `One-Sentence-Description` |
| `contentURI` | opt | SOURCE_MAPPED | 1/1 | `Submission URL` |
| `projectId` | **YES** | SOURCE_MAPPED | 3/3 | `Project` |
| `grantPoolId` | **YES** | SOURCE_MAPPED | 3/3 | `Round` |
| `discussionTo` | opt | HARDCODED | 0/1 | hardcoded |
| `licenseURI` | opt | HARDCODED | 0/1 | hardcoded |
| `isInactive` | opt | HARDCODED | 0/1 | hardcoded: `False` |
| `applicationCompletionRate` | opt | HARDCODED | 0/1 | hardcoded: `0.0` |
| `fundsAskedInUSD` | opt | SOURCE_MAPPED | 1/1 | P2 [scf/grant_applications/fundsAskedInUSD] Mapped to same column as fundsApprovedInUSD (Total Awarded USD) — no separate 'funds asked' field exists in Airtable export |
| `fundsAsked` | opt | SOURCE_MAPPED | 1/1 | `Total Awarded (USD)` |
| `fundsApproved` | opt | SOURCE_MAPPED | 1/1 | `Total Awarded (USD)` |
| `fundsApprovedInUSD` | opt | SOURCE_MAPPED | 1/1 | `Total Awarded (USD)` |
| `payoutAddress` | opt | HARDCODED | 0/1 | hardcoded: `{}` |
| `payouts` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `socials` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `status` | opt | SOURCE_MAPPED | 1/1 | `Total Awarded (USD)` |

### Issues

- **P2** P2 [scf/grant_applications/fundsAskedInUSD] Mapped to same column as fundsApprovedInUSD (Total Awarded USD) — no separate 'funds asked' field exists in Airtable export
- **P3** [grant_applications/status] Only 2 status values used (approved/pending). DAOIP-5 enum has 6 values: pending, in_review, approved, funded, rejected, completed. Rejected submissions are not present in Airtable export view.

---

## Consolidated Issue Register

### P2 — Semantic Mismatch

- P2 [scf/grant_applications/fundsAskedInUSD] Mapped to same column as fundsApprovedInUSD (Total Awarded USD) — no separate 'funds asked' field exists in Airtable export

### P3 — Structural Gap

- [grant_applications/status] Only 2 status values used (approved/pending). DAOIP-5 enum has 6 values: pending, in_review, approved, funded, rejected, completed. Rejected submissions are not present in Airtable export view.
