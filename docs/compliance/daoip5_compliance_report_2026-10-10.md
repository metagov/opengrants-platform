# DAOIP-5 Compliance Report
**Generated:** 2026-10-10
**Sources assessed:** ens, gitcoin2, giveth, privote, scf
**Methodology:** `docs/compliance/daoip5_assessment_methodology.md`

## Summary

| Source | Grant Pools | Projects | Grant Applications | Overall | P0 |
|--------|-------------|----------|--------------------|---------|-----|
| **ens** | 40% | 25% | NOT IMPL | **33%** | **1** |
| **gitcoin2** | 73% | 75% | 65% | **70%** | 0 |
| **giveth** | 47% | 67% | NOT IMPL | **56%** | 0 |
| **privote** | 27% | 50% | 40% | **38%** | 0 |
| **scf** | 67% | 50% | 65% | **62%** | 0 |

_Column-backed % = (SOURCE_MAPPED + COMPUTED fields) ÷ total fields. Measures the fraction of DAOIP-5 fields that carry forward information from the underlying source system. HARDCODED and NULL fields are excluded._

## P0 Issues — Fabricated Required Fields

> These fields are required by DAOIP-5 but contain fabricated values. They corrupt downstream analytics silently.

- P0 [ens/grant_pools/totalGrantPoolSizeInUSD] Required field hardcoded to fabricated value: '0.0'

---

## ENS — ENS DAO Small Grants (Snapshot: small-grants.eth)
**Schema version:** 1.0.0 | **Last updated:** 2026-03-28T00:00:00Z
**Schema map:** `og_dagster/configs/schema_maps/active/daoip5_ens.yaml`

### Grant Pools
**Column-backed fields:** 40% | **Weighted score:** 56%

| Field | Required | Category | Points | Notes |
|-------|----------|----------|--------|-------|
| `id` | **YES** | SOURCE_MAPPED | 3/3 | `id` |
| `name` | **YES** | SOURCE_MAPPED | 3/3 | `title` |
| `description` | **YES** | SOURCE_MAPPED | 3/3 | P2 [ens/grant_pools/description] Template string 'ENS Small Grants — {title}' is functionally identical to name field |
| `applicationsURI` | opt | SOURCE_MAPPED | 1/1 | P2 [ens/grant_pools/applicationsURI] Mapped to proposal body markdown text (free text), not a URI |
| `totalGrantPoolSizeInUSD` | **YES** | HARDCODED | 0/3 | P0 [ens/grant_pools/totalGrantPoolSizeInUSD] Required field hardcoded to fabricated value: '0.0' |
| `isOpen` | **YES** | SOURCE_MAPPED | 3/3 | `state` |
| `closeDate` | opt | SOURCE_MAPPED | 1/1 | `end_ts` |
| `image` | opt | NULL | 0/1 | no source |
| `coverImage` | opt | HARDCODED | 0/1 | hardcoded |
| `email` | opt | HARDCODED | 0/1 | hardcoded |
| `grantFundingMechanism` | **YES** | HARDCODED | 1/3 | hardcoded: `'Ranked Choice Voting` |
| `governanceURI` | opt | HARDCODED | 0/1 | hardcoded |
| `attestationIssuersURI` | opt | HARDCODED | 0/1 | hardcoded: `None` |
| `requiredCredentials` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `totalGrantPoolSize` | opt | HARDCODED | 0/1 | hardcoded: `[{'amount': 0, 'denomination': 'ENS'}]` |

**Required field failures (2):**
- `totalGrantPoolSizeInUSD` — HARDCODED (fabricated)
- `grantFundingMechanism` — HARDCODED

### Projects
**Column-backed fields:** 25% | **Weighted score:** 40%

| Field | Required | Category | Points | Notes |
|-------|----------|----------|--------|-------|
| `id` | **YES** | COMPUTED | 2/3 |  |
| `name` | **YES** | SOURCE_MAPPED | 3/3 | `choice_name` |
| `description` | **YES** | SOURCE_MAPPED | 3/3 | `proposal_title` |
| `contentURI` | **YES** | NULL | 0/3 | no source |
| `image` | opt | NULL | 0/1 | no source |
| `coverImage` | opt | HARDCODED | 0/1 | hardcoded |
| `email` | opt | HARDCODED | 0/1 | hardcoded |
| `socials` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `membersURI` | opt | HARDCODED | 0/1 | hardcoded |
| `attestationIssuersURI` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `relevantTo` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `licenseURI` | opt | HARDCODED | 0/1 | hardcoded |

**Required field failures (1):**
- `contentURI` — NULL

### Grant Applications

**NOT IMPLEMENTED** — no schema defined in YAML.
> [grant_applications] Schema not implemented — ENS uses Snapshot ranked-choice voting; applicants are vote choices, not formal grant applications with fund requests or status transitions

### Issues

- **P0** P0 [ens/grant_pools/totalGrantPoolSizeInUSD] Required field hardcoded to fabricated value: '0.0'
- **P2** P2 [ens/grant_pools/description] Template string 'ENS Small Grants — {title}' is functionally identical to name field
- **P2** P2 [ens/grant_pools/applicationsURI] Mapped to proposal body markdown text (free text), not a URI
- **P3** [grant_applications] Schema not implemented — ENS uses Snapshot ranked-choice voting; applicants are vote choices, not formal grant applications with fund requests or status transitions

---

## GITCOIN2 — Gitcoin 2.0 CSV Snapshot (17 March 2026)
**Schema version:** 1.0.0 | **Last updated:** 2026-03-26T00:00:00Z
**Schema map:** `og_dagster/configs/schema_maps/active/daoip5_gitcoin2.yaml`

### Grant Pools
**Column-backed fields:** 73% | **Weighted score:** 85%

| Field | Required | Category | Points | Notes |
|-------|----------|----------|--------|-------|
| `id` | **YES** | SOURCE_MAPPED | 3/3 | `id` |
| `name` | **YES** | SOURCE_MAPPED | 3/3 | `round_metadata` |
| `description` | **YES** | SOURCE_MAPPED | 3/3 | `round_metadata` |
| `grantFundingMechanism` | **YES** | SOURCE_MAPPED | 3/3 | `strategy_name` |
| `isOpen` | **YES** | SOURCE_MAPPED | 3/3 | `donations_end_time` |
| `closeDate` | opt | SOURCE_MAPPED | 1/1 | `donations_end_time` |
| `totalGrantPoolSizeInUSD` | **YES** | SOURCE_MAPPED | 3/3 | `match_amount_in_usd` |
| `image` | opt | SOURCE_MAPPED | 1/1 | `round_metadata` |
| `applicationsURI` | opt | SOURCE_MAPPED | 1/1 | `application_metadata_cid` |
| `coverImage` | opt | NULL | 0/1 | no source |
| `email` | opt | SOURCE_MAPPED | 1/1 | `round_metadata` |
| `governanceURI` | opt | NULL | 0/1 | no source |
| `attestationIssuersURI` | opt | NULL | 0/1 | no source |
| `requiredCredentials` | opt | HARDCODED | 0/1 | hardcoded: `[]` |

### Projects
**Column-backed fields:** 75% | **Weighted score:** 85%

| Field | Required | Category | Points | Notes |
|-------|----------|----------|--------|-------|
| `id` | **YES** | SOURCE_MAPPED | 3/3 | `id` |
| `name` | **YES** | SOURCE_MAPPED | 3/3 | `name` |
| `description` | **YES** | SOURCE_MAPPED | 3/3 | `metadata` |
| `contentURI` | **YES** | SOURCE_MAPPED | 3/3 | `metadata_cid` |
| `email` | opt | SOURCE_MAPPED | 1/1 | P2 [gitcoin2/projects/email] Field mapped to metadata.projectTwitter (Twitter handle) — not an email address |
| `membersURI` | opt | SOURCE_MAPPED | 1/1 | `metadata` |
| `attestationIssuersURI` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `image` | opt | SOURCE_MAPPED | 1/1 | `metadata` |
| `licenseURI` | opt | NULL | 0/1 | no source |
| `relevantTo` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `socials` | opt | SOURCE_MAPPED | 1/1 | `metadata` |

### Grant Applications
**Column-backed fields:** 65% | **Weighted score:** 75%

| Field | Required | Category | Points | Notes |
|-------|----------|----------|--------|-------|
| `id` | **YES** | SOURCE_MAPPED | 3/3 | `id` |
| `grantPoolId` | **YES** | SOURCE_MAPPED | 3/3 | `round_id` |
| `grantPoolName` | opt | NULL | 0/1 | P1 [gitcoin2/grant_applications/grantPoolName] round name available via join on round_id → bronze_gitcoin2_rounds.round_metadata |
| `projectId` | **YES** | SOURCE_MAPPED | 3/3 | `project_id` |
| `createdAt` | **YES** | SOURCE_MAPPED | 3/3 | `timestamp` |
| `status` | opt | SOURCE_MAPPED | 1/1 | `status` |
| `fundsAsked` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `fundsAskedInUSD` | opt | NULL | 0/1 | no source |
| `fundsApprovedInUSD` | opt | SOURCE_MAPPED | 1/1 | `total_amount_donated_in_usd` |
| `payoutAddress` | opt | SOURCE_MAPPED | 1/1 | `anchor_address` |
| `payouts` | opt | HARDCODED | 0/1 | P1 [gitcoin2/grant_applications/payouts] bronze_gitcoin2_payouts table exists (from applications_payouts.csv) with transaction_hash/amount_in_usd/timestamp but is not joined into silver |
| `discussionTo` | opt | NULL | 0/1 | no source |
| `licenseURI` | opt | NULL | 0/1 | no source |
| `applicationCompletionRate` | opt | NULL | 0/1 | no source |
| `socials` | opt | SOURCE_MAPPED | 1/1 | `metadata` |

### Issues

- **P1** P1 [gitcoin2/grant_applications/grantPoolName] round name available via join on round_id → bronze_gitcoin2_rounds.round_metadata
- **P1** P1 [gitcoin2/grant_applications/payouts] bronze_gitcoin2_payouts table exists (from applications_payouts.csv) with transaction_hash/amount_in_usd/timestamp but is not joined into silver
- **P2** P2 [gitcoin2/projects/email] Field mapped to metadata.projectTwitter (Twitter handle) — not an email address
- **P3** [grant_pools/grantFundingMechanism] Only maps to 'Quadratic Funding' or 'Direct Grants'. DAOIP-5 spec recognizes 31 mechanisms. Other strategy_name values fall through.

---

## GIVETH — Giveth Mainnet API
**Schema version:** 1.1.0 | **Last updated:** 2025-12-09T18:30:00Z
**Schema map:** `og_dagster/configs/schema_maps/active/daoip5_giveth.yaml`

### Grant Pools
**Column-backed fields:** 47% | **Weighted score:** 67%

| Field | Required | Category | Points | Notes |
|-------|----------|----------|--------|-------|
| `id` | **YES** | SOURCE_MAPPED | 3/3 | `qfRound_id` |
| `name` | **YES** | SOURCE_MAPPED | 3/3 | `qfRound_title` |
| `description` | **YES** | SOURCE_MAPPED | 3/3 | `qfRound_description` |
| `grantFundingMechanism` | **YES** | HARDCODED | 1/3 | hardcoded: `'Quadratic Funding` |
| `isOpen` | **YES** | SOURCE_MAPPED | 3/3 | `isActive` |
| `closeDate` | opt | SOURCE_MAPPED | 1/1 | `qfRound_endDate` |
| `totalGrantPoolSizeInUSD` | **YES** | SOURCE_MAPPED | 3/3 | `qfRound_allocatedFundUSD` |
| `image` | opt | SOURCE_MAPPED | 1/1 | `qfRound_bannerBgImage` |
| `applicationsURI` | opt | NULL | 0/1 | no source |
| `coverImage` | opt | NULL | 0/1 | no source |
| `email` | opt | NULL | 0/1 | no source |
| `governanceURI` | opt | NULL | 0/1 | no source |
| `attestationIssuersURI` | opt | NULL | 0/1 | no source |
| `requiredCredentials` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `totalGrantPoolSize` | opt | HARDCODED | 0/1 | hardcoded: `[{'amount': 0, 'denomination': 'ETH'}]` |

**Required field failures (1):**
- `grantFundingMechanism` — HARDCODED

### Projects
**Column-backed fields:** 67% | **Weighted score:** 80%

| Field | Required | Category | Points | Notes |
|-------|----------|----------|--------|-------|
| `id` | **YES** | SOURCE_MAPPED | 3/3 | `id` |
| `name` | **YES** | SOURCE_MAPPED | 3/3 | `title` |
| `description` | **YES** | SOURCE_MAPPED | 3/3 | `description` |
| `contentURI` | **YES** | SOURCE_MAPPED | 3/3 | `projectUrl` |
| `email` | opt | SOURCE_MAPPED | 1/1 | `contacts` |
| `membersURI` | opt | SOURCE_MAPPED | 1/1 | `website` |
| `attestationIssuersURI` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `image` | opt | SOURCE_MAPPED | 1/1 | `image` |
| `coverImage` | opt | NULL | 0/1 | no source |
| `licenseURI` | opt | NULL | 0/1 | no source |
| `relevantTo` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `socials` | opt | SOURCE_MAPPED | 1/1 | `socialProfiles` |

### Grant Applications

**NOT IMPLEMENTED** — no schema defined in YAML.

---

## PRIVOTE — Privote Onchain Registry (Arbitrum)
**Schema version:** 1.4.0 | **Last updated:** 2025-11-06T19:30:00Z
**Schema map:** `og_dagster/configs/schema_maps/active/daoip5_privote.yaml`

### Grant Pools
**Column-backed fields:** 27% | **Weighted score:** 48%

| Field | Required | Category | Points | Notes |
|-------|----------|----------|--------|-------|
| `id` | **YES** | SOURCE_MAPPED | 3/3 | `id` |
| `name` | **YES** | SOURCE_MAPPED | 3/3 | `metadataUrl` |
| `description` | **YES** | SOURCE_MAPPED | 3/3 | `Privacy-focused quadratic funding round on Arbitrum using MACI` |
| `applicationsURI` | opt | SOURCE_MAPPED | 1/1 | `metadataUrl` |
| `totalGrantPoolSizeInUSD` | **YES** | HARDCODED | 1/3 | hardcoded: `3500.0 * 3.1145` |
| `totalGrantPoolSize` | opt | HARDCODED | 0/1 | hardcoded: `json.dumps({'currency': 'USD', 'amount': 3500.0 * 3.1145})` |
| `isOpen` | **YES** | HARDCODED | 1/3 | hardcoded: `False` |
| `closeDate` | opt | HARDCODED | 0/1 | hardcoded: `'2025-10-29T23:59:59.000Z` |
| `image` | opt | HARDCODED | 0/1 | hardcoded: `'https://example.com/grant-pool.jpg` |
| `coverImage` | opt | HARDCODED | 0/1 | hardcoded: `'https://example.com/cover.jpg` |
| `email` | opt | HARDCODED | 0/1 | hardcoded: `'grants@example.com` |
| `grantFundingMechanism` | **YES** | HARDCODED | 1/3 | hardcoded: `'Quadratic Funding` |
| `governanceURI` | opt | HARDCODED | 0/1 | hardcoded: `'https://example.com/governance` |
| `attestationIssuersURI` | opt | HARDCODED | 0/1 | hardcoded: `'https://example.com/attestations` |
| `requiredCredentials` | opt | HARDCODED | 0/1 | hardcoded: `[]` |

**Required field failures (3):**
- `totalGrantPoolSizeInUSD` — HARDCODED
- `isOpen` — HARDCODED
- `grantFundingMechanism` — HARDCODED

### Projects
**Column-backed fields:** 50% | **Weighted score:** 70%

| Field | Required | Category | Points | Notes |
|-------|----------|----------|--------|-------|
| `id` | **YES** | SOURCE_MAPPED | 3/3 | `recipient_index` |
| `name` | **YES** | SOURCE_MAPPED | 3/3 | `metadata_name` |
| `description` | **YES** | SOURCE_MAPPED | 3/3 | `metadata_bio` |
| `contentURI` | **YES** | SOURCE_MAPPED | 3/3 | `metadata_url` |
| `image` | opt | SOURCE_MAPPED | 1/1 | `metadata_profileImageUrl` |
| `coverImage` | opt | HARDCODED | 0/1 | hardcoded: `'https://example.com/cover.jpg` |
| `email` | opt | HARDCODED | 0/1 | hardcoded: `'contact@example.com` |
| `socials` | opt | SOURCE_MAPPED | 1/1 | `metadata_websiteUrl` |
| `membersURI` | opt | HARDCODED | 0/1 | hardcoded: `'https://example.com/members` |
| `attestationIssuersURI` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `relevantTo` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `licenseURI` | opt | HARDCODED | 0/1 | hardcoded: `'https://example.com/license` |

### Grant Applications
**Column-backed fields:** 40% | **Weighted score:** 50%

| Field | Required | Category | Points | Notes |
|-------|----------|----------|--------|-------|
| `id` | **YES** | SOURCE_MAPPED | 3/3 | `recipient_index` |
| `discussionTo` | opt | HARDCODED | 0/1 | hardcoded: `'https://example.com/discussion` |
| `licenseURI` | opt | HARDCODED | 0/1 | hardcoded: `'https://example.com/license` |
| `isInactive` | opt | HARDCODED | 0/1 | hardcoded: `False` |
| `applicationCompletionRate` | opt | HARDCODED | 0/1 | hardcoded: `100.0` |
| `description` | opt | HARDCODED | 0/1 | hardcoded: `'Project application for GG24 Privote Round` |
| `contentURI` | opt | HARDCODED | 0/1 | hardcoded: `'https://example.com/application` |
| `projectId` | **YES** | SOURCE_MAPPED | 3/3 | `recipient_index` |
| `grantPoolId` | **YES** | HARDCODED | 1/3 | hardcoded: `'daoip-5:privote:grantPool:gg24` |
| `fundsAskedInUSD` | opt | SOURCE_MAPPED | 1/1 | `allocation_eth` |
| `payoutAddress` | opt | HARDCODED | 0/1 | hardcoded: `{'address': '0x0000000000000000000000000000000000000000'}` |
| `fundsApprovedInUSD` | opt | SOURCE_MAPPED | 1/1 | `allocation_eth` |
| `status` | opt | HARDCODED | 0/1 | hardcoded: `'approved` |
| `socials` | opt | HARDCODED | 0/1 | hardcoded: `[]` |
| `createdAt` | **YES** | HARDCODED | 1/3 | hardcoded: `'2025-10-14T00:00:01.000Z` |
| `payouts` | opt | HARDCODED | 0/1 | hardcoded: `[]` |

**Required field failures (2):**
- `grantPoolId` — HARDCODED
- `createdAt` — HARDCODED

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
| `createdAt` | **YES** | SOURCE_MAPPED | 3/3 | `_airtable_created_time` |
| `projectId` | **YES** | SOURCE_MAPPED | 3/3 | `Project` |
| `grantPoolId` | **YES** | SOURCE_MAPPED | 3/3 | `Round` |
| `discussionTo` | opt | HARDCODED | 0/1 | hardcoded |
| `licenseURI` | opt | HARDCODED | 0/1 | hardcoded |
| `isInactive` | opt | HARDCODED | 0/1 | hardcoded: `False` |
| `applicationCompletionRate` | opt | HARDCODED | 0/1 | hardcoded: `0.0` |
| `fundsAskedInUSD` | opt | SOURCE_MAPPED | 1/1 | P2 [scf/grant_applications/fundsAskedInUSD] Mapped to same column as fundsApprovedInUSD (Total Awarded USD) — no separate 'funds asked' field exists in Airtable export |
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

### P0 — Fabricated Required Fields

- P0 [ens/grant_pools/totalGrantPoolSizeInUSD] Required field hardcoded to fabricated value: '0.0'

### P1 — Data Available But Not Connected

- P1 [gitcoin2/grant_applications/grantPoolName] round name available via join on round_id → bronze_gitcoin2_rounds.round_metadata
- P1 [gitcoin2/grant_applications/payouts] bronze_gitcoin2_payouts table exists (from applications_payouts.csv) with transaction_hash/amount_in_usd/timestamp but is not joined into silver

### P2 — Semantic Mismatch

- P2 [ens/grant_pools/description] Template string 'ENS Small Grants — {title}' is functionally identical to name field
- P2 [ens/grant_pools/applicationsURI] Mapped to proposal body markdown text (free text), not a URI
- P2 [gitcoin2/projects/email] Field mapped to metadata.projectTwitter (Twitter handle) — not an email address
- P2 [scf/grant_applications/fundsAskedInUSD] Mapped to same column as fundsApprovedInUSD (Total Awarded USD) — no separate 'funds asked' field exists in Airtable export

### P3 — Structural Gap

- [grant_applications] Schema not implemented — ENS uses Snapshot ranked-choice voting; applicants are vote choices, not formal grant applications with fund requests or status transitions
- [grant_pools/grantFundingMechanism] Only maps to 'Quadratic Funding' or 'Direct Grants'. DAOIP-5 spec recognizes 31 mechanisms. Other strategy_name values fall through.
- [grant_applications/status] Only 2 status values used (approved/pending). DAOIP-5 enum has 6 values: pending, in_review, approved, funded, rejected, completed. Rejected submissions are not present in Airtable export view.
