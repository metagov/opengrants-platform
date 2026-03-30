# DAOIP-5 Field-Level Compliance Report
**Generated:** 2026-03-31
**Sources assessed:** SCF (snapshot: Feb 23, 2026), ENS (snapshot: Mar 24, 2026), Gitcoin 2.0 (snapshot: Mar 17, 2026)
**Assessment script:** `scripts/daoip5_compliance_check.py`
**Methodology:** `docs/compliance/daoip5_assessment_methodology.md`

---

## What This Report Measures

This report assesses whether each DAOIP-5 field in the silver layer is populated from an actual source column in the bronze table, or whether it is a hardcoded placeholder that makes the schema validate without providing meaningful data.

**Primary lens — required fields:** DAOIP-5 specifies certain fields as MUST (RFC 2119). A source that fails a required field is structurally non-compliant, regardless of how well it handles optional fields. This report leads with required field analysis.

**Secondary lens — overall field coverage:** After required fields, total source-column-backed coverage across all fields is reported for context.

The four field categories used throughout:

| Category | Meaning |
|----------|---------|
| **SOURCE_MAPPED** | Populated directly from a named source column. The transform (if any) processes the column's value — it does not ignore it. |
| **COMPUTED** | Synthesized from two or more source columns, or constructed into a new structure from one column. Still data-driven. |
| **HARDCODED** | Returns a literal constant regardless of what the source data contains. Detected by `lambda _:` pattern — the input is explicitly discarded. |
| **NULL** | No source column mapped, no transform defined. The silver field will be database NULL. |

A hardcoded required field is classified **P0** — it passes structural validation but corrupts downstream analytics by injecting fabricated values into arithmetic and comparisons.

---

## Executive Summary — Required Field Compliance

| Source | GrantPool (6 req.) | Project (4 req.) | GrantApplication (4 req.) | Total Required | P0 Issues |
|--------|-------------------|-----------------|--------------------------|----------------|-----------|
| **Gitcoin 2.0** | 6/6 — 100% | 4/4 — 100% | 4/4 — 100% | **14/14 — 100%** | 0 |
| **SCF** | 6/6 — 100% | 4/4 — 100% | 3/4 — 75% | **13/14 — 93%** | 1 |
| **ENS** | 5/6 — 83% | 3/4 — 75% | NOT IMPLEMENTED | **8/10 — 80%** of implemented schemas | 1 |

**Overall source-column-backed coverage (required + optional fields combined):**

| Source | Grant Pools | Projects | Grant Applications | Overall |
|--------|-------------|----------|--------------------|---------|
| **Gitcoin 2.0** | 67% | 92% | 65% | **74%** |
| **SCF** | 60% | 50% | 55% | **55%** |
| **ENS** | 27% | 17% | NOT IMPLEMENTED | **14%** |

---

## DAOIP-5 Required Fields Reference

| Schema | Required Fields (RFC 2119 MUST) |
|--------|---------------------------------|
| **GrantPool** | `id`, `name`, `description`, `grantFundingMechanism`, `isOpen`, `totalGrantPoolSizeInUSD` |
| **Project** | `id`, `name`, `description`, `contentURI` |
| **GrantApplication** | `id`, `grantPoolId`, `projectId`, `createdAt` |

---

## 1. Gitcoin 2.0

**Schema map:** `og_dagster/configs/schema_maps/active/daoip5_gitcoin2.yaml`
**Bronze tables:** `bronze_gitcoin2_rounds`, `bronze_gitcoin2_projects`, `bronze_gitcoin2_applications`

### Required Field Assessment

#### GrantPool — Required Fields (6/6 pass)

| Field | Source Column | Category | Status | Notes |
|-------|---------------|----------|--------|-------|
| `id` | `id` | SOURCE_MAPPED | PASS | Prefixed `daoip-5:gitcoin2:grantPool:{v}` |
| `name` | `round_metadata` | COMPUTED | PASS | JSON extraction: `round_metadata.name` |
| `description` | `round_metadata` | COMPUTED | PASS | JSON extraction: `round_metadata.description` |
| `grantFundingMechanism` | `strategy_name` | SOURCE_MAPPED | PASS | Maps QF/Direct from strategy name. Defaults to `'Direct Grants'` for unrecognized strategies — may misclassify some rounds |
| `isOpen` | `donations_end_time` | COMPUTED | PASS | Derived: `donations_end_time > '2026-01-01'`. Reasonable proxy but not a direct boolean column |
| `totalGrantPoolSizeInUSD` | `match_amount_in_usd` | SOURCE_MAPPED | PASS | Matching pool size. Note: this is the pre-funded match, not total distributed |

> **YAML governance gap:** `description`, `grantFundingMechanism`, `isOpen`, and `totalGrantPoolSizeInUSD` are all marked `required: false` in the YAML despite being DAOIP-5 required fields. The data flows correctly today, but the pipeline will not catch these going NULL if a source column changes.

#### Project — Required Fields (4/4 pass)

| Field | Source Column | Category | Status | Notes |
|-------|---------------|----------|--------|-------|
| `id` | `id` | SOURCE_MAPPED | PASS | Prefixed `daoip-5:gitcoin2:project:{v}` |
| `name` | `name` | SOURCE_MAPPED | PASS | Direct column — the project's registered name |
| `description` | `metadata` | COMPUTED | PASS | JSON extraction: `metadata.description` |
| `contentURI` | `metadata_cid` | SOURCE_MAPPED | PASS | Constructed as `ipfs://{metadata_cid}` |

> **YAML governance gap:** `description` and `contentURI` marked `required: false`. Same risk as above.

#### GrantApplication — Required Fields (4/4 pass)

| Field | Source Column | Category | Status | Notes |
|-------|---------------|----------|--------|-------|
| `id` | `id` | SOURCE_MAPPED | PASS | Application's own identifier |
| `grantPoolId` | `round_id` | SOURCE_MAPPED | PASS | Foreign key to round, prefixed into DAOIP-5 ID format |
| `projectId` | `project_id` | SOURCE_MAPPED | PASS | Foreign key to project. Marked `required: false` in YAML — governance gap |
| `createdAt` | `timestamp` | SOURCE_MAPPED | PASS | Genuine ISO 8601 per-application creation timestamp |

### Selected Optional Field Coverage

| DAOIP-5 Field | Source Column | Category | Notes |
|---------------|---------------|----------|-------|
| `status` | `status` | SOURCE_MAPPED | ACCEPTED / REJECTED / PENDING / PENDING_REVIEW — normalized to lowercase. Gitcoin's 4 values map imperfectly to DAOIP-5's 6-value enum but substantially better than a binary |
| `fundsApprovedInUSD` | `total_amount_donated_in_usd` | SOURCE_MAPPED | For QF rounds this is community donations, not a committee approval. Field name is semantically imprecise in QF context |
| `payoutAddress` | `anchor_address` | SOURCE_MAPPED | Project's Safe or EOA payout address, structured as `{type: "EthereumAddress", value: "0x..."}` |
| `payouts` | — | HARDCODED — P1 | `[]` hardcoded. The `bronze_gitcoin2_payouts` table exists with full disbursement records. Not yet joined into the silver applications table. Most immediately fixable gap in the entire dataset |
| `grantPoolName` | — | NULL — P1 | Round name not in `applications.csv`. Accessible via `round_id` join to `rounds.csv`. Join not yet implemented |
| `email` | `metadata` | SOURCE_MAPPED — P2 | Maps `metadata.projectTwitter` into the `email` field. A Twitter handle is not a contact email. Should be NULL |
| `fundsAsked` | — | HARDCODED | `[]` — QF model has no formal funding request step. Structurally absent from source system |

**Gitcoin 2.0 required field compliance: 14/14 (100%). No P0 issues.**

---

## 2. SCF (Stellar Community Fund)

**Schema map:** `og_dagster/configs/schema_maps/active/daoip5_scf.yaml`
**Bronze tables:** `bronze_scf_rounds`, `bronze_scf_projects`, `bronze_scf_submissions`

### Required Field Assessment

#### GrantPool — Required Fields (6/6 pass)

| Field | Source Column | Category | Status | Notes |
|-------|---------------|----------|--------|-------|
| `id` | `Name` | SOURCE_MAPPED | PASS | Prefixed `daoip-5:scf:grantPool:{v}` |
| `name` | `Name` | SOURCE_MAPPED | PASS | Direct column |
| `description` | `Description` | SOURCE_MAPPED | PASS | Fallback to `"No description provided."` for nulls — source column is read first |
| `grantFundingMechanism` | `Type` | SOURCE_MAPPED | PASS | Reads `Type` column but collapses to `"direct_grants"` or `"other"`. Source-driven but semantically lossy |
| `isOpen` | `Submission Close Date` | SOURCE_MAPPED | PASS | Compares close date to today — genuine date column |
| `totalGrantPoolSizeInUSD` | `Total Awarded (USD)` | SOURCE_MAPPED | PASS | Award amount from Airtable |

#### Project — Required Fields (4/4 pass)

| Field | Source Column | Category | Status | Notes |
|-------|---------------|----------|--------|-------|
| `id` | `Title` | SOURCE_MAPPED | PASS | Prefixed `daoip-5:scf:project:{v}` |
| `name` | `Title` | SOURCE_MAPPED | PASS | Direct column |
| `description` | `Description` | SOURCE_MAPPED | PASS | Fallback to `"No description provided."` for nulls |
| `contentURI` | `Website` | SOURCE_MAPPED | PASS | Website URL used as content URI. Semantic approximation — website is a homepage, not a canonical content address — but source-backed. Not marked `required: true` in YAML — governance gap |

#### GrantApplication — Required Fields (3/4 pass) — **1 P0**

| Field | Source Column | Category | Status | Notes |
|-------|---------------|----------|--------|-------|
| `id` | `Submission / Project` | SOURCE_MAPPED | PASS | Prefixed `daoip-5:scf:application:{v}` |
| `grantPoolId` | `Round` | SOURCE_MAPPED | PASS | Round name as foreign key |
| `projectId` | `Project` | SOURCE_MAPPED | PASS | Project name as foreign key |
| `createdAt` | null | **HARDCODED** | **FAIL — P0** | `lambda _: '2025-01-01T00:00:00Z'` — every application record carries the same fabricated timestamp. The Airtable CSV export does not include per-submission creation timestamps. The Airtable API *does* expose `created_time` per record — this field is absent from the current CSV export configuration only |

**The `createdAt` fabrication means every SCF application appears to have been created on January 1, 2025. Any time-series analysis, cohort analysis, or rate-of-application metric built on SCF data will produce incorrect results.**

### Selected Optional Field Coverage

| DAOIP-5 Field | Source Column | Category | Notes |
|---------------|---------------|----------|-------|
| `fundsApprovedInUSD` | `Total Awarded (USD)` | SOURCE_MAPPED | Award amount per submission — well-populated |
| `fundsApproved` | `Total Awarded (USD)` | COMPUTED | Structured as `[{amount, token: "USD"}]` |
| `fundsAskedInUSD` | `Total Awarded (USD)` | SOURCE_MAPPED — P2 | Uses awarded amount as a proxy for ask. Airtable does not capture a separate "requested" amount. Semantically inaccurate but the best available proxy |
| `status` | `Total Awarded (USD)` | COMPUTED | Derived: `"approved"` if amount > 0, `"pending"` otherwise. Binary — no equivalent of `in_review`, `funded`, `rejected`, `completed` |
| `payoutAddress` | — | HARDCODED | `{}` — Airtable does not collect blockchain payout addresses |
| `payouts` | — | HARDCODED | `[]` — payment records exist in separate Airtable tables but are not joined into the submission silver layer |
| `socials` | Multiple columns | COMPUTED | GitHub, Discord, X, LinkedIn, Website assembled into a structured array — well-done |

**SCF required field compliance: 13/14 (93%). One P0: `createdAt` fabricated.**

---

## 3. ENS Small Grants

**Schema map:** `og_dagster/configs/schema_maps/active/daoip5_ens.yaml`
**Bronze tables:** `bronze_ens_proposals`, `bronze_ens_project_choices`
**Note:** GrantApplication schema is not implemented for ENS.

### Required Field Assessment

#### GrantPool — Required Fields (5/6 pass) — **1 P0**

| Field | Source Column | Category | Status | Notes |
|-------|---------------|----------|--------|-------|
| `id` | `id` | SOURCE_MAPPED | PASS | Snapshot proposal ID prefixed as DAOIP-5 ID |
| `name` | `title` | SOURCE_MAPPED | PASS | Proposal title |
| `description` | `title` | SOURCE_MAPPED | PASS* | Constructs `"ENS Small Grants — {title}"`. Uses the title column — same source as `name`, not a separate description field. Not marked `required: true` in YAML |
| `grantFundingMechanism` | null | HARDCODED | PARTIAL | `lambda _: 'Ranked Choice Voting'`. No source column — value is accurate but hardcoded. Not marked required in YAML. Ranked Choice Voting is also not in the DAOIP-5 allowed enum; the value will fail enum validation |
| `isOpen` | `state` | SOURCE_MAPPED | PASS | `state == 'active'` — genuine Snapshot proposal state field. Marked `required: false` in YAML |
| `totalGrantPoolSizeInUSD` | null | **HARDCODED** | **FAIL — P0** | `lambda _: 0.0` — ENS funding is denominated in ENS token voting weight, not USD. A USD equivalent is not derivable from the Snapshot source. Writing `0.0` into a required numeric field fabricates a zero that participates in cross-platform funding totals as if ENS rounds had zero funding. Marked `required: false` in YAML |

**On `grantFundingMechanism`:** `'Ranked Choice Voting'` is not in the DAOIP-5 allowed enum (`quadratic_funding`, `direct_grants`, `retroactive_funding`, `rfp`, `other`). This will fail enum validation. The closest accurate value is `'other'`.

**On `totalGrantPoolSizeInUSD`:** The correct resolution is to omit this field (NULL) with a documented structural note, not to write `0.0`. A NULL signals "unknown", while `0.0` signals "this round had no funding", which is false.

#### Project — Required Fields (3/4 pass)

| Field | Source Column | Category | Status | Notes |
|-------|---------------|----------|--------|-------|
| `id` | `proposal_id` + `choice_number` | COMPUTED | PASS | Composite key from proposal ID and choice index |
| `name` | `choice_name` | SOURCE_MAPPED | PASS | The applicant's name as written in the Snapshot vote choice |
| `description` | `proposal_title` | SOURCE_MAPPED — P2 | PASS* | Constructs `"ENS Small Grants applicant in: {round title}"`. This is the round title, not a project description. Every applicant in the same round gets an identical description. Semantically inaccurate but source-backed. Not marked required in YAML |
| `contentURI` | null | NULL | **FAIL** | No source column, no transform. Will be database NULL. ENS applicants are Snapshot vote choices (plain text strings) — there is no URL or content pointer in the source data for individual applicants |

#### GrantApplication — NOT IMPLEMENTED

ENS applicants are vote choices in a Snapshot governance proposal, not formal grant applicants with funding requests, project IDs, or submission timestamps. The DAOIP-5 GrantApplication schema (`id`, `grantPoolId`, `projectId`, `createdAt`) has no structural equivalent in the ENS data model. Implementing it would require fabricating all four required fields.

This is a structural incompatibility, not a data pipeline gap. The correct disposition is to document ENS as having 0 GrantApplication records with a schema note explaining why, rather than manufacturing false application records.

### Selected Optional Field Coverage

| DAOIP-5 Field | Source Column | Category | Notes |
|---------------|---------------|----------|-------|
| `closeDate` | `end_ts` | SOURCE_MAPPED | Unix timestamp converted to ISO 8601 — well done |
| `applicationsURI` | `body` | SOURCE_MAPPED | Proposal body text used as applications URI — this is the full markdown body, not a URI. Semantically incorrect |
| `totalGrantPoolSize` | null | HARDCODED | `[{amount: 0, denomination: 'ENS'}]` — denomination is correct but amount is 0. Better than `totalGrantPoolSizeInUSD` in that it at least names the correct token, but the 0 amount is still a fabrication |
| Extension: `totalVotes`, `scoringTotal`, `startTs`, `endTs` | Multiple | SOURCE_MAPPED | Rich voting data in the extension namespace — the voting mechanics are well-captured |

**ENS required field compliance: 8/10 (80%) over implemented schemas. One P0: `totalGrantPoolSizeInUSD` fabricated as 0.0. GrantApplication not implemented.**

---

## P0 Issue Register

P0 = a required DAOIP-5 field carrying a fabricated value. These corrupt downstream analytics.

| # | Source | Schema | Field | Fabricated Value | Downstream Impact | Fix |
|---|--------|--------|-------|-----------------|-------------------|-----|
| P0-01 | SCF | GrantApplication | `createdAt` | `'2025-01-01T00:00:00Z'` for every record | All time-series, cohort, and application velocity analysis on SCF data is incorrect. Every submission appears to have been created on the same day | Add `created_time` to the Airtable CSV export configuration — it is exposed by the Airtable API on every record |
| P0-02 | ENS | GrantPool | `totalGrantPoolSizeInUSD` | `0.0` for every round | ENS rounds contribute $0 to any cross-platform funding total. The platform will report ENS as a zero-funding program | Change to NULL with a documented structural note. ENS funding is in ENS tokens — report it in the extension namespace only |

---

## YAML Governance Gaps

The following fields are **required by the DAOIP-5 spec** but are marked `required: false` (or have no `required` flag) in the YAML schema maps. The data currently flows correctly, but the pipeline will not detect these fields going NULL if a source column changes, is renamed, or has its JSON structure modified.

| Source | Schema | Field | YAML `required` | Spec |
|--------|--------|-------|-----------------|------|
| Gitcoin 2.0 | GrantPool | `description` | `false` | REQUIRED |
| Gitcoin 2.0 | GrantPool | `grantFundingMechanism` | `false` | REQUIRED |
| Gitcoin 2.0 | GrantPool | `isOpen` | `false` | REQUIRED |
| Gitcoin 2.0 | GrantPool | `totalGrantPoolSizeInUSD` | `false` | REQUIRED |
| Gitcoin 2.0 | Project | `description` | `false` | REQUIRED |
| Gitcoin 2.0 | Project | `contentURI` | `false` | REQUIRED |
| Gitcoin 2.0 | GrantApplication | `projectId` | `false` | REQUIRED |
| ENS | GrantPool | `description` | `false` | REQUIRED |
| ENS | GrantPool | `isOpen` | `false` | REQUIRED |
| ENS | GrantPool | `totalGrantPoolSizeInUSD` | `false` | REQUIRED |
| ENS | Project | `description` | `false` | REQUIRED |
| ENS | Project | `contentURI` | `false` | REQUIRED |
| SCF | Project | `contentURI` | not set | REQUIRED |

These should be corrected to `required: true` in the YAML so that the compliance check script and pipeline validation can catch regressions.

---

## P1/P2/P3 Issue Register

### P1 — Data exists in bronze but is not wired to silver

| # | Source | Field | What exists | What's missing |
|---|--------|-------|-------------|----------------|
| P1-01 | Gitcoin 2.0 | `payouts` (GrantApplication) | `bronze_gitcoin2_payouts` — full disbursement records with tx hash, amount, token, timestamp | Join from applications silver to payouts bronze via `application_id` |
| P1-02 | Gitcoin 2.0 | `grantPoolName` (GrantApplication) | Round name in `bronze_gitcoin2_rounds` | Join from applications silver to rounds bronze via `round_id` |
| P1-03 | SCF | `payouts` (GrantApplication) | Payment records in separate Airtable tables | Join into submission silver layer |
| P1-04 | SCF | `createdAt` | Airtable API exposes `created_time` on every record | Add `created_time` to the CSV export config or switch to API-based ingestion |

### P2 — Source column exists but semantic match is wrong

| # | Source | Field | Column used | Correct semantic |
|---|--------|-------|-------------|-----------------|
| P2-01 | Gitcoin 2.0 | `email` (Project) | `metadata.projectTwitter` | Twitter handle ≠ contact email. Should be NULL |
| P2-02 | SCF | `fundsAskedInUSD` | `Total Awarded (USD)` | Awarded amount ≠ requested amount. No ask data in source |
| P2-03 | ENS | `description` (Project) | `proposal_title` | Round title ≠ project description — all applicants in a round share the same description |
| P2-04 | ENS | `applicationsURI` (GrantPool) | `body` | Full proposal markdown body ≠ a URI pointing to application list |

### P3 — Structural gaps

| # | Source | Gap |
|---|--------|-----|
| P3-01 | ENS | GrantApplication schema not implemented — structural incompatibility between Snapshot vote choices and DAOIP-5 application model |
| P3-02 | ENS | `grantFundingMechanism` hardcoded to `'Ranked Choice Voting'` which is not a valid DAOIP-5 enum value. Nearest correct value is `'other'` |
| P3-03 | SCF | `grantFundingMechanism` collapses all rounds to `"direct_grants"` or `"other"` regardless of the actual `Type` column value |
| P3-04 | All | `totalGrantPoolSize` (multi-denomination array) has hardcoded or incorrect token denominations (SCF: USD, Gitcoin: ETH regardless of actual token, ENS: ENS with amount 0) |

---

## Recommendations by Priority

### Immediate (unblock required field compliance)

1. **P0-01 — SCF `createdAt`:** Add `created_time` to the Airtable CSV export, or switch the SCF bronze asset to use the Airtable API (`fetch_airtable_table`) which already returns `_airtable_id` and `created_time` per record. The sensor infrastructure for this already exists.

2. **P0-02 — ENS `totalGrantPoolSizeInUSD`:** Change the transform from `lambda _: 0.0` to `lambda _: None`. Add a structural note to the ENS section of this report and the round compliance report. Separately track ENS funding in the extension namespace as `io.ens.totalVotingPower`.

3. **YAML governance — mark required fields correctly:** Update `required: false` → `required: true` for the 13 fields listed in the governance gaps table above. No data change required — this only affects pipeline validation.

### Near-term (improve analytical completeness)

4. **P1-01 — Gitcoin `payouts`:** Add a `LEFT JOIN bronze_gitcoin2_payouts ON application_id` to the Gitcoin silver applications transformation. All data is in bronze.

5. **P1-02 — Gitcoin `grantPoolName`:** Add a `LEFT JOIN bronze_gitcoin2_rounds ON round_id` to bring the round name into application records.

6. **P2-01 — Gitcoin `email`:** Set to NULL. Do not populate with Twitter handle.

### Structural (requires upstream data or schema decisions)

7. **P3-02 — ENS `grantFundingMechanism`:** Change hardcoded value from `'Ranked Choice Voting'` to `'other'` to pass enum validation.

8. **P3-01 — ENS GrantApplication:** Document as a known structural incompatibility. Consider whether ENS vote choices should be modelled as something other than GrantApplications (e.g., a custom extension schema).

---

## Footnotes

**Compliance Rate Definition (field-level):** `source-column-backed %` = (SOURCE_MAPPED + COMPUTED) ÷ total fields × 100. Measures the fraction of fields that carry forward information from the underlying source system.

**Required Field Compliance:** Counts fields classified as SOURCE_MAPPED or COMPUTED over the set of DAOIP-5 required fields per schema. HARDCODED required fields count as failures (P0). NULL required fields count as failures (P3).

**This report and the round-level report:** This document measures field-level schema data quality. The companion report (`daoip5_round_compliance_report_2026-03-31.md`) measures round-level indexing coverage — how many rounds are available in DAOIP-5 at all.
