# DAOIP-5 Data Compliance Report
**Generated:** 2026-03-31
**Sources assessed:** SCF (snapshot: Feb 23, 2026), ENS (snapshot: Mar 24, 2026), Gitcoin 2.0 (snapshot: Mar 17, 2026)
**Assessment script:** `scripts/daoip5_compliance_check.py`
**Methodology:** `docs/compliance/daoip5_assessment_methodology.md`

---

## What This Report Measures

This report does not measure whether the data *exists* — all three sources have data. It measures whether
each DAOIP-5 field in the silver layer is **populated from an actual source column** in the bronze table,
or whether it is a **hardcoded placeholder** installed to make the schema validate without providing meaningful data.

The distinction is critical. A hardcoded field passes structural validation — the column exists, the
type is correct, the value is non-null — but it carries no information. Worse, hardcoded numeric fields
(e.g., `totalGrantPoolSizeInUSD = 0.0`) actively corrupt downstream sums, averages, and cross-platform
comparisons because they participate in arithmetic as if they were genuine measurements.

The four field categories used throughout this report:

| Category | Meaning |
|----------|---------|
| **SOURCE_MAPPED** | Field is populated directly from a named source column. The transform (if any) processes the column's value — it does not ignore it. |
| **COMPUTED** | Field is synthesized from two or more source columns, or constructed into a new structure (e.g., a JSON array) from one source column. The output is still data-driven. |
| **HARDCODED** | Field returns a literal constant — an empty string, a fixed timestamp, a zero — regardless of what the source data contains. The source column may be null, or it may exist but be ignored by a `lambda _:` transform. |
| **NULL** | No source column is mapped and no transform is defined. The silver field will be database NULL. |

**Coverage metric used in summary tables:**
`source-column-backed %` = (SOURCE_MAPPED + COMPUTED fields) ÷ total fields × 100.
This measures the fraction of fields that carry forward information from the underlying source system.

---

## Executive Summary

| Source | Grant Pools | Projects | Grant Applications | **Overall** |
|--------|-------------|----------|--------------------|-------------|
| **Gitcoin 2.0** | 67% column-backed | 92% column-backed | 65% column-backed | **74%** |
| **SCF** | 60% column-backed | 50% column-backed | 55% column-backed | **55%** |
| **ENS** | 27% column-backed | 17% column-backed | NOT IMPLEMENTED | **14%** |

All three sources pass DAOIP-5 **structural** validation — field names are correct, types match,
ID formats follow the `daoip-5:{system}:{schema}:{id}` convention. The compliance gaps documented
here are entirely at the **data content** layer, not the schema shape layer.

No source is fully compliant. The root causes differ significantly by source:

- **Gitcoin 2.0:** High coverage overall. Primary gaps are optional fields that are either absent
  from the source system by design (`fundsAsked`) or present in a separate bronze table that hasn't
  been joined into silver (`payouts`). These are fixable without needing new data from Gitcoin.

- **SCF:** Moderate coverage. The critical failure is `createdAt` — a required field — being
  hardcoded to `'2025-01-01T00:00:00Z'` for every single application record. The Airtable export
  does not include per-submission timestamps. This makes SCF application data temporally opaque.
  The Airtable API does expose `created_time` per record; it is simply not present in the current
  CSV export configuration.

- **ENS:** Low coverage by design. The ENS Small Grants program operates through Snapshot-based
  ranked-choice voting, not a formal grant application workflow. Applicants are choices within a
  governance proposal, not independent submitters. This structural mismatch means most DAOIP-5
  fields have no meaningful source counterpart. Additionally, ENS funding amounts are denominated
  in voting power (ENS token weight), not USD, making `totalGrantPoolSizeInUSD` fundamentally
  unanswerable from the available source data — yet the current schema map writes `0.0` into this
  required field, which is a fabrication.

---

## DAOIP-5 Schema Reference

### Required Fields (RFC 2119 MUST language in spec)

| Schema | Required Fields |
|--------|----------------|
| **GrantPool** | `id`, `name`, `description`, `grantFundingMechanism`, `isOpen`, `totalGrantPoolSizeInUSD` |
| **Project** | `id`, `name`, `description`, `contentURI` |
| **GrantApplication** | `id`, `grantPoolId`, `projectId`, `createdAt` |

A required field that is hardcoded to a fabricated value is classified **P0** and noted
separately from fields that are simply missing. Missing is recoverable; fabricated is actively
misleading to any downstream consumer of the data.

### High-Value Optional Fields

These fields are optional per the DAOIP-5 spec but are tracked separately because they are
the most analytically useful. Their absence degrades the platform's ability to answer the
questions that motivated building this platform in the first place:

| Field | Why it matters |
|-------|---------------|
| `fundsAskedInUSD` | Enables ask-vs-approved analysis — are grant programs fully funding what applicants request? |
| `fundsApprovedInUSD` | The primary measure of capital deployed per application |
| `payoutAddress` | Enables on-chain verification and de-duplication of grants across platforms |
| `payouts` | Actual disbursement records — distinguishes approved-but-unpaid from funded |
| `status` (full enum) | Without the full enum (pending, in_review, approved, funded, rejected, completed), funnel analysis is impossible |
| `closeDate` | Required for computing round duration and application velocity |
| `applicationsURI` | The discovery link — where other systems go to find applications for this pool |
| `socials` | Project identity signal — helps deduplicate projects that applied across multiple platforms |
| `image` | Presentation layer — affects whether the platform looks credible to grant seekers |
| `email` | Operational contact — required for any notification or outreach features |
| `membersURI` | Team accountability — links the project to its contributors |

---

## Gitcoin 2.0 — Detailed Assessment

**Data snapshot:** `raw_data/Gitcoin/17_March_2026/` — 16 CSVs
**Schema map:** `og_dagster/configs/schema_maps/active/daoip5_gitcoin2.yaml` (879 lines)
**Bronze tables:** `bronze_gitcoin2_rounds`, `bronze_gitcoin2_projects`, `bronze_gitcoin2_applications`, `bronze_gitcoin2_payouts`, `bronze_gitcoin2_donations`, `bronze_gitcoin2_attestations`

Gitcoin 2.0 is the strongest of the three sources. It has genuine timestamps, genuine payout
addresses, a full status enum, and rich project metadata stored in IPFS-linked JSON blobs.
Its gaps are concentrated in optional fields that either don't exist in the source system
(`fundsAsked`, `licenseURI`) or exist in a separate bronze table that hasn't been joined
into the silver applications table (`payouts`, `grantPoolName`).

### GrantPool (`rounds.csv`, 32 source columns → `silver_gitcoin2_grant_pools`)

| DAOIP-5 Field | Required | Source Column | Category | Notes |
|---|---|---|---|---|
| `id` | YES | `id` | SOURCE_MAPPED | Prefixed `daoip-5:gitcoin2:grantPool:{v}` per spec |
| `name` | YES | `round_metadata` | SOURCE_MAPPED | JSON extraction: `round_metadata.name` — the `round_metadata` column stores the full round configuration as a JSON string |
| `description` | YES | `round_metadata` | SOURCE_MAPPED | JSON extraction: `round_metadata.description` |
| `grantFundingMechanism` | YES | `strategy_name` | SOURCE_MAPPED | `strategy_name` column maps to QF or Direct Grants — see P3 note on limited enum coverage |
| `isOpen` | YES | `donations_end_time` | COMPUTED | Derived: `donations_end_time > '2026-01-01'`. Uses the donation window end as the round close signal, which is a reasonable proxy but not a direct boolean field |
| `totalGrantPoolSizeInUSD` | YES | `match_amount_in_usd` | SOURCE_MAPPED | Direct column — this is the matching pool size, not total distributed |
| `closeDate` | OPTIONAL | `donations_end_time` | SOURCE_MAPPED | The donation window end is the operative close date for QF rounds |
| `applicationsURI` | RECOMMENDED | `application_metadata_cid` | SOURCE_MAPPED | IPFS CID — a pointer to the application metadata, not a browsable HTTP URL. Technically compliant but not human-navigable without an IPFS gateway |
| `email` | OPTIONAL | `round_metadata` | SOURCE_MAPPED | JSON extraction: `round_metadata.support.info` — in practice this is often blank or contains a Discord invite URL rather than an email address, but the path from source is legitimate |
| `image` | OPTIONAL | `round_metadata` | SOURCE_MAPPED | JSON extraction: `round_metadata.roundMetadataPtrCid` — returns an IPFS CID, not a direct image URL. Requires gateway resolution to render |
| `totalGrantPoolSize` | OPTIONAL | `match_amount` | COMPUTED | Constructed as `[{amount: float(match_amount), denomination: 'ETH'}]`. Denomination is hardcoded to ETH which may be incorrect for rounds on non-ETH chains or using stablecoins |
| `coverImage` | OPTIONAL | — | NULL | No cover image field in rounds source data |
| `governanceURI` | RECOMMENDED | — | NULL | Gitcoin does not expose governance documentation URIs in the round export |
| `attestationIssuersURI` | OPTIONAL | — | NULL | EAS attestations exist (`bronze_gitcoin2_attestations`) but no URI pointing to trusted issuers is surfaced in the rounds data |
| `requiredCredentials` | OPTIONAL | — | HARDCODED | `[]` — Gitcoin rounds do not have credential requirements in the current data model |

**Grant Pool summary: 10/15 fields are column-backed (67%). All 6 required fields pass.**

Notable observation: `totalGrantPoolSize` uses ETH as the denomination regardless of the actual
token used in the round. Some Gitcoin rounds use USDC or other stablecoins. This means the
denomination is factually wrong for a subset of rounds, though the numeric value itself comes
from source data.

### Project (`projects.csv`, 15 source columns → `silver_gitcoin2_projects`)

| DAOIP-5 Field | Required | Source Column | Category | Notes |
|---|---|---|---|---|
| `id` | YES | `id` | SOURCE_MAPPED | Prefixed `daoip-5:gitcoin2:project:{v}` |
| `name` | YES | `name` | SOURCE_MAPPED | Direct column — the project's registered name in the Gitcoin registry |
| `description` | YES | `metadata` | SOURCE_MAPPED | JSON extraction: `metadata.description` — the `metadata` column contains the full project profile as a JSON blob linked to an IPFS CID |
| `contentURI` | YES | `metadata_cid` | SOURCE_MAPPED | Constructed as `ipfs://{metadata_cid}` — the canonical IPFS address of the project's full metadata |
| `image` | OPTIONAL | `metadata` | SOURCE_MAPPED | JSON extraction: `metadata.logoImg` — the project logo, stored as an IPFS CID inside the metadata blob |
| `coverImage` | OPTIONAL | `metadata` | SOURCE_MAPPED | JSON extraction: `metadata.bannerImg` — project banner image, also an IPFS CID |
| `email` | OPTIONAL | `metadata` | WRONG (P2) | JSON extraction: `metadata.projectTwitter` — this is a Twitter/X handle, not an email address. The DAOIP-5 `email` field expects a contact email. The metadata JSON does not contain an email field. This should be set to NULL rather than populated with a social media handle |
| `membersURI` | OPTIONAL | `metadata` | SOURCE_MAPPED | JSON extraction: `metadata.website` — used as a proxy for a team page. A project's website is a reasonable stand-in when no explicit team URI exists |
| `socials` | OPTIONAL | `metadata` | SOURCE_MAPPED | JSON extraction of `metadata.projectTwitter` and `metadata.projectGithub`, structured into a `[{platform, url}]` array per DAOIP-5 spec |
| `licenseURI` | OPTIONAL | — | NULL | Gitcoin does not collect open-source license information at the project level |
| `attestationIssuersURI` | OPTIONAL | — | HARDCODED | `[]` — no attestation issuer list is surfaced at the project level |
| `relevantTo` | OPTIONAL | — | HARDCODED | `[]` — Gitcoin does not have a category taxonomy that maps cleanly to this field |

**Project summary: 11/12 fields are column-backed (92%). This is the strongest schema across all three sources. All 4 required fields pass.**

The lone column-backed field with a semantic problem is `email`, which is filled with a Twitter
handle. Since `email` is optional, this does not affect the required-field score, but it does
mean any downstream feature that sends notifications or correspondence using the `email` field
will silently fail or misroute to a social handle.

### GrantApplication (`applications.csv`, 17 source columns → `silver_gitcoin2_grant_applications`)

| DAOIP-5 Field | Required | Source Column | Category | Notes |
|---|---|---|---|---|
| `id` | YES | `id` | SOURCE_MAPPED | The application's own identifier in the Gitcoin registry |
| `grantPoolId` | YES | `round_id` | SOURCE_MAPPED | Foreign key to the round — prefixed into DAOIP-5 ID format |
| `projectId` | YES | `project_id` | SOURCE_MAPPED | Foreign key to the project — prefixed into DAOIP-5 ID format |
| `createdAt` | YES | `timestamp` | SOURCE_MAPPED | The `timestamp` column in `applications.csv` is a genuine ISO 8601 creation timestamp for each application record. This is the one area where Gitcoin clearly outperforms SCF |
| `name` | OPTIONAL | `metadata` | SOURCE_MAPPED | JSON extraction: `metadata.application.project.title` — the project's self-reported name at time of application |
| `description` | OPTIONAL | `metadata` | SOURCE_MAPPED | JSON extraction: `metadata.application.project.description` — the project description as submitted in this specific application |
| `status` | RECOMMENDED | `status` | SOURCE_MAPPED | The `status` column contains: `ACCEPTED`, `REJECTED`, `PENDING`, `PENDING_REVIEW`. These are normalized to lowercase. Note that Gitcoin uses 4 status values while DAOIP-5 defines 6 (`pending`, `in_review`, `approved`, `funded`, `rejected`, `completed`). The mapping is imperfect but substantially better than SCF's binary |
| `fundsApprovedInUSD` | OPTIONAL | `total_amount_donated_in_usd` | SOURCE_MAPPED | For QF rounds this is total community donations, not a committee-approved grant. For Direct Grants rounds it is a formal approval amount. The field name `fundsApproved` is somewhat misleading in the QF context |
| `fundsApproved` | OPTIONAL | `total_amount_donated_in_usd` | COMPUTED | Constructed as `[{amount: float(v), denomination: 'USD'}]` — wraps the USD amount into the DAOIP-5 multi-denomination array format |
| `payoutAddress` | OPTIONAL | `anchor_address` | SOURCE_MAPPED | The `anchor_address` column contains the project's Safe or EOA address used for payouts, structured as `{type: "EthereumAddress", value: "0x..."}` |
| `contentURI` | OPTIONAL | `metadata_cid` | SOURCE_MAPPED | Application metadata IPFS CID — the full application form responses are stored here |
| `isInactive` | OPTIONAL | `status` | COMPUTED | Derived: `True` if `status` is `REJECTED` or `CANCELLED`. Reasonable business logic using genuine status data |
| `socials` | OPTIONAL | `metadata` | SOURCE_MAPPED | Twitter and GitHub handles extracted from the application metadata blob |
| `grantPoolName` | RECOMMENDED | — | NULL (P1) | The round name is not included in `applications.csv`. It exists in `rounds.csv` and is accessible via a `round_id` join, but this join has not been implemented in the silver transformation. Every application record has a NULL where the round name should be |
| `fundsAsked` | OPTIONAL | — | HARDCODED | `[]` — Gitcoin's QF model does not have a formal funding request step. Projects apply to rounds and the community determines allocation through donations. There is no "requested amount" concept in the source system |
| `fundsAskedInUSD` | OPTIONAL | — | NULL | Same reason as above — no funding request data exists |
| `payouts` | OPTIONAL | — | HARDCODED (P1) | `[]` — **the `bronze_gitcoin2_payouts` table exists, ingested from `applications_payouts.csv`, and contains `transaction_hash`, `amount_in_usd`, `amount`, `token_address`, `timestamp`, and `sender` for every disbursement. This data is fully available in the bronze layer and has not been joined into the silver applications table. This is the most immediately fixable gap in the entire dataset** |
| `discussionTo` | OPTIONAL | — | NULL | Gitcoin does not surface forum/discussion links in the application export |
| `licenseURI` | OPTIONAL | — | NULL | Not collected at application level |
| `applicationCompletionRate` | OPTIONAL | — | NULL | Gitcoin does not track milestone completion rate in the export |

**Application summary: 13/20 fields are column-backed (65%). All 4 required fields pass.**

The most actionable gap is `payouts`. The disbursement data exists in the bronze layer and wiring it
into the silver applications table is a single aggregation join:

```sql
-- What needs to happen in the silver layer
SELECT
    a.id,
    JSON_AGG(
        JSON_BUILD_OBJECT(
            'transaction_hash', p.transaction_hash,
            'amount_in_usd',    p.amount_in_usd,
            'token_address',    p.token_address,
            'timestamp',        p.timestamp,
            'sender',           p.sender
        )
    ) AS payouts
FROM bronze_gitcoin2_applications a
LEFT JOIN bronze_gitcoin2_payouts p ON p.application_id = a.id
GROUP BY a.id
```

---

## SCF (Stellar Community Fund) — Detailed Assessment

**Data snapshot:** `raw_data/SCF/23_February_2026/` — 3 CSVs (87 total source columns across all files)
**Schema map:** `og_dagster/configs/schema_maps/active/daoip5_scf.yaml` (772 lines)
**Bronze tables:** `bronze_scf_projects`, `bronze_scf_submissions`, `bronze_scf_rounds`
**Source system:** Airtable (fetched via `dlt` connector)

SCF's Airtable export is relatively information-rich at the project and round level — it has
categories, regions, social links, thumbnails, audit reports, team descriptions, and Soroban
integration flags. However, the application-level export is severely limited. The Airtable
view that produces `Awarded Submissions` does not expose per-submission timestamps, applicant
wallet addresses, or detailed workflow status. These are structural limitations of what Airtable
exports rather than pipeline design failures.

### GrantPool (`Build Award Rounds`, 31 source columns → `silver_scf_grant_pools`)

| DAOIP-5 Field | Required | Source Column | Category | Notes |
|---|---|---|---|---|
| `id` | YES | `Name` | SOURCE_MAPPED | The round's `Name` column (e.g., "SCF #28") prefixed into DAOIP-5 ID format |
| `name` | YES | `Name` | SOURCE_MAPPED | Direct — same column as id source, round display name |
| `description` | YES | `Description` | SOURCE_MAPPED | Round description from Airtable. A defensive fallback of `"No description provided."` is used when the column is empty, which occurs for some older rounds |
| `grantFundingMechanism` | YES | `Type` | SOURCE_MAPPED | The `Type` column maps to either `"direct_grants"` or `"other"`. SCF's multi-phase process (abstract review → panel review → community vote → award) is more nuanced than either value captures. See P3-6 |
| `isOpen` | YES | `Submission Close Date` | COMPUTED | Derived by comparing `Submission Close Date` to the current date. Accurate for the question "is this round currently accepting applications?" |
| `totalGrantPoolSizeInUSD` | YES | `Total Awarded (USD)` | SOURCE_MAPPED | The `Total Awarded (USD)` column on the rounds table is the sum of all awards in that round |
| `closeDate` | OPTIONAL | `Submission Close Date` | SOURCE_MAPPED | Direct parse of the submission deadline date |
| `applicationsURI` | RECOMMENDED | `Round URL` | SOURCE_MAPPED | The Airtable-hosted round URL where submissions can be viewed |
| `image` | OPTIONAL | `Image` | SOURCE_MAPPED | Airtable stores images in the format `filename (url)` inside a single string. The transform extracts the URL from inside the parentheses |
| `totalGrantPoolSize` | OPTIONAL | `Total Awarded (USD)` | COMPUTED | Constructed as `[{amount: float(v), denomination: 'USD'}]` |
| `coverImage` | OPTIONAL | — | HARDCODED | `''` — Airtable does not have a cover image field for rounds |
| `email` | OPTIONAL | — | HARDCODED | `''` — SCF does not publish a contact email per round in Airtable |
| `governanceURI` | RECOMMENDED | — | HARDCODED | `''` — SCF governance documentation exists (on the SCF website) but is not linked from the Airtable record and has not been hardcoded as a known static URL |
| `attestationIssuersURI` | OPTIONAL | — | NULL | `None` — no attestation issuer infrastructure in SCF's current model |
| `requiredCredentials` | OPTIONAL | — | HARDCODED | `[]` — SCF does not use on-chain credential requirements |

**Grant Pool summary: 9/15 fields are column-backed (60%). All 6 required fields pass.**

One notable data quality issue outside the category system: `totalGrantPoolSizeInUSD` is populated
from `Total Awarded (USD)` rather than from a pre-round budget declaration. This means the field
reflects *what was awarded* rather than *what was budgeted*. For rounds that underspent their
budget, the reported pool size will be lower than the actual available capital. This is a semantic
imprecision, not a HARDCODED field — the value comes from source data — but it should be noted
when interpreting cross-platform funding comparisons.

### Project (`Awarded Projects`, 24 source columns → `silver_scf_projects`)

| DAOIP-5 Field | Required | Source Column | Category | Notes |
|---|---|---|---|---|
| `id` | YES | `Title` | SOURCE_MAPPED | Project title lowercased and slugified — e.g., `"daoip-5:scf:project:bloom_finance"` |
| `name` | YES | `Title` | SOURCE_MAPPED | The project's display name as registered in Airtable |
| `description` | YES | `Description` | SOURCE_MAPPED | Multi-paragraph project description. Defensive fallback `"No description provided."` for projects where this field was left blank |
| `contentURI` | YES | `Website` | SOURCE_MAPPED | The project's primary website URL as submitted to SCF |
| `image` | OPTIONAL | `Thumbnail` | SOURCE_MAPPED | Project logo image, extracted from Airtable's `filename (url)` format |
| `socials` | OPTIONAL | `Github, Discord, X, LinkedIn, Website` | COMPUTED | Built from five separate source columns into a `[{platform, url}]` array. This is the most comprehensive social coverage of any source — SCF explicitly collects GitHub, Discord, X, LinkedIn, and website. The transform filters out empty columns so the array only contains populated entries |
| `coverImage` | OPTIONAL | — | HARDCODED | `''` — no cover/banner image concept in the SCF Airtable schema |
| `email` | OPTIONAL | — | HARDCODED | `''` — SCF Airtable does not collect project contact emails. This is a gap in the underlying data collection, not the pipeline |
| `membersURI` | OPTIONAL | — | HARDCODED | `''` — no team page or contributor list URL is collected by SCF |
| `attestationIssuersURI` | OPTIONAL | — | HARDCODED | `[]` — no attestation infrastructure |
| `relevantTo` | OPTIONAL | — | HARDCODED | `[]` — no category taxonomy that maps to this field |
| `licenseURI` | OPTIONAL | — | HARDCODED | `''` — SCF does have an `Open-Source?` boolean field in the data (accessible in the extensions namespace as `org.stellar.communityfund.openSource`) but does not collect the actual license URI |

**Project summary: 6/12 fields are column-backed (50%). All 4 required fields pass.**

SCF's project-level data is strong on identity (name, description, website, socials) but weak on
provenance and accountability fields (email, team members, license). The Airtable schema was
designed for grant management UX, not for DAOIP-5 interoperability, and the gaps reflect that origin.

### GrantApplication (`Awarded Submissions`, 33 source columns → `silver_scf_grant_applications`)

| DAOIP-5 Field | Required | Source Column | Category | Notes |
|---|---|---|---|---|
| `id` | YES | `Submission / Project` | SOURCE_MAPPED | Application ID derived from the submission title + project name combination |
| `grantPoolId` | YES | `Round` | SOURCE_MAPPED | The round name from the `Round` column, prefixed into DAOIP-5 ID format |
| `projectId` | YES | `Project` | SOURCE_MAPPED | The project name from the `Project` column, prefixed into DAOIP-5 ID format |
| `createdAt` | **YES** | — | **HARDCODED — P0** | `'2025-01-01T00:00:00Z'` written verbatim for every single application record. The Airtable `Awarded Submissions` export view does not include a submission timestamp column. The Airtable API does expose `created_time` per record, but the current CSV export configuration does not include it. This is the most damaging compliance failure in the entire SCF dataset: every SCF application appears to have been submitted simultaneously on January 1, 2025, which makes any temporal analysis — funding trends over time, seasonal patterns, cohort analysis — impossible |
| `grantPoolName` | RECOMMENDED | `Round` | SOURCE_MAPPED | The human-readable round name (e.g., "SCF #28") taken directly from the `Round` column |
| `projectName` | OPTIONAL | `Project` | SOURCE_MAPPED | The project name associated with this submission |
| `description` | OPTIONAL | `One-Sentence-Description` | SOURCE_MAPPED | A single-sentence summary of the submission, collected by SCF as part of the application form |
| `contentURI` | OPTIONAL | `Submission URL` | SOURCE_MAPPED | The Airtable URL for this specific submission record |
| `name` | OPTIONAL | `Submission Title` | SOURCE_MAPPED | The title of the grant submission (distinct from the project name) |
| `fundsApprovedInUSD` | OPTIONAL | `Total Awarded (USD)` | SOURCE_MAPPED | The USD amount awarded to this submission |
| `fundsApproved` | OPTIONAL | `Total Awarded (USD)` | COMPUTED | Wrapped into `[{amount: float(v), denomination: 'USD'}]` array format |
| `fundsAskedInUSD` | OPTIONAL | `Total Awarded (USD)` | WRONG (P2) | Mapped to the same `Total Awarded (USD)` column as `fundsApprovedInUSD`. The Airtable export does not have a separate "amount requested" column. Using the awarded amount as a proxy for the requested amount destroys the distinction between these two fields and makes ask-vs-approval rate analysis impossible |
| `status` | RECOMMENDED | `Total Awarded (USD)` | COMPUTED (P3) | Derived as `"approved"` if `Total Awarded (USD) > 0`, otherwise `"pending"`. This binary logic uses only 2 of the 6 DAOIP-5 enum values. Rejected applications do not appear in the `Awarded Submissions` view at all — the view is filtered to awarded projects only. In-review, funded, and completed states are not represented |
| `payoutAddress` | OPTIONAL | — | HARDCODED | `{}` — Airtable never collected Stellar wallet addresses. SCF pays out in XLM and USD, and the payment destination addresses are tracked in a separate internal payment system, not in Airtable |
| `payouts` | OPTIONAL | — | HARDCODED | `[]` — no on-chain transaction data. SCF payments are off-chain bank/wallet transfers. The `Total Paid (XLM)` and `Total Paid (USD)` columns exist in the source and are captured in the extensions namespace, but these are aggregate totals, not individual transaction records with hashes |
| `socials` | OPTIONAL | — | HARDCODED | `[]` — social links exist at the project level (and are correctly mapped there) but are not replicated to the application level. Downstream consumers querying applications will not find social information without a join to the project table |
| `discussionTo` | OPTIONAL | — | HARDCODED | `''` — SCF does not maintain discussion threads per application in a URL-addressable form |
| `licenseURI` | OPTIONAL | — | HARDCODED | `''` — no per-application license URI |
| `isInactive` | OPTIONAL | — | HARDCODED | `False` — all records in the export are from active/completed awards; inactive submissions are not exported |
| `applicationCompletionRate` | OPTIONAL | — | HARDCODED | `0.0` — the `Tranche Completion %` column exists in the source and is captured in the extensions namespace, but has not been mapped into this core DAOIP-5 field |

**Application summary: 11/20 fields are column-backed (55%). 3/4 required fields pass. `createdAt` fails — P0.**

The `Tranche Completion %` gap is worth calling out separately from the hardcoded `0.0`:
SCF is unique among the three sources in that it tracks milestone/tranche completion rates
in its source data (`Tranche Completion %` column, values like `33%`, `66%`, `100%`).
This maps directly to DAOIP-5's `applicationCompletionRate` field. The column exists in the
bronze table but the YAML schema map writes `0.0` instead of reading it. This is a mapping
oversight that can be fixed without any new data from SCF.

---

## ENS Small Grants — Detailed Assessment

**Data snapshot:** `raw_data/ENS/grants/` — 2 JSON files (24 proposals, 1,562 individual votes)
**Schema map:** `og_dagster/configs/schema_maps/active/daoip5_ens.yaml` (288 lines — the shortest of all schema maps, reflecting the limited available data)
**Bronze tables:** `bronze_ens_proposals`, `bronze_ens_project_choices`
**Source system:** Snapshot API (`small-grants.eth` space)

ENS Small Grants is a fundamentally different model from SCF and Gitcoin. Rather than collecting
formal applications with project descriptions, team details, and funding requests, ENS runs
governance votes where token holders allocate their voting weight across a slate of candidates.
The "application" is the act of submitting a choice to a Snapshot proposal. The "funding decision"
is the vote tally. There is no application form, no submission timestamp, no funding request amount,
and no payout address — because those concepts don't exist in the ENS voting model.

This structural incompatibility is the primary reason ENS scores so low. Most DAOIP-5 fields
simply have no counterpart in the Snapshot voting data model.

### GrantPool (`smallgrants_proposals.json` → `silver_ens_grant_pools`)

| DAOIP-5 Field | Required | Source Column | Category | Notes |
|---|---|---|---|---|
| `id` | YES | `id` | SOURCE_MAPPED | The Snapshot proposal ID, a 66-character hex string, prefixed into DAOIP-5 format |
| `name` | YES | `title` | SOURCE_MAPPED | The Snapshot proposal title, e.g., "Public Goods Round 13" |
| `description` | YES | `title` | WEAK (P2) | Constructed as `"ENS Small Grants — {title}"` — this is effectively the same string as `name` with a prefix. The proposal's `body` field contains several paragraphs of actual description text about the round's purpose and eligibility, but that field is currently used for `applicationsURI` (incorrectly — see below). The description field should use `body` |
| `grantFundingMechanism` | YES | — | HARDCODED | Literal string `'Ranked Choice Voting'`. This is accurate — every ENS Small Grants round does use ranked choice voting — but the value is written into the YAML map as a constant rather than derived from a source column. Since Snapshot doesn't expose a funding mechanism field, this is the correct implementation; it is a known-accurate hardcode rather than a fabrication |
| `isOpen` | YES | `state` | SOURCE_MAPPED | `state == 'active'` — Snapshot exposes proposal state directly |
| `totalGrantPoolSizeInUSD` | **YES** | — | **HARDCODED — P0** | `0.0` written as a literal. This is the most critical compliance failure in the ENS dataset. ENS Small Grants pools have distributed genuine capital — the funding amounts exist, they are denominated in ENS tokens, and the USD equivalent is calculable using ENS/USD price data at the round close date. Writing `0.0` instead of either the correct USD equivalent or an explicit `null` corrupts every cross-platform funding aggregation. Any report that sums `totalGrantPoolSizeInUSD` across all sources will under-report total capital deployed by the full ENS historical allocation |
| `closeDate` | OPTIONAL | `end_ts` | SOURCE_MAPPED | Unix timestamp converted to ISO 8601. Snapshot's `end` field is a Unix epoch integer |
| `applicationsURI` | RECOMMENDED | `body` | WRONG (P2) | The full proposal `body` text — several paragraphs of markdown — is written into a URI field. A URI is a link; a body is prose. These are categorically different. No applications URI exists in the Snapshot data model; the field should be NULL or pointed to the Snapshot proposal URL (the proposal `id` can be used to construct a Snapshot URL) |
| `totalGrantPoolSize` | OPTIONAL | — | HARDCODED | `[{amount: 0, denomination: 'ENS'}]` — the zero amount has the same problem as `totalGrantPoolSizeInUSD`. At minimum the denomination is accurate |
| `image` | OPTIONAL | — | NULL | Snapshot proposals do not have associated image fields |
| `coverImage` | OPTIONAL | — | HARDCODED | `''` — no cover image concept in Snapshot |
| `email` | OPTIONAL | — | HARDCODED | `''` — Snapshot proposals do not have contact email fields |
| `governanceURI` | RECOMMENDED | — | HARDCODED | `''` — ENS governance documentation exists but is not linked from the Snapshot proposal data |
| `attestationIssuersURI` | OPTIONAL | — | NULL | `None` |
| `requiredCredentials` | OPTIONAL | — | HARDCODED | `[]` |

**Grant Pool summary: 4/15 fields are column-backed (27%). `totalGrantPoolSizeInUSD` fails with a fabricated value — P0.**

### Project (vote choices from `smallgrants_votes.json` → `silver_ens_projects`)

| DAOIP-5 Field | Required | Source Column | Category | Notes |
|---|---|---|---|---|
| `id` | YES | `proposal_id` + `choice_number` | COMPUTED | Composite key constructed as `daoip-5:ens:project:{proposal_id}:{choice_number}`. A project that appears in multiple rounds will have a different `id` in each round because the choice number changes — this means a project that applied to 5 ENS rounds has 5 distinct project records rather than one record with 5 applications |
| `name` | YES | `choice_name` | SOURCE_MAPPED | The choice text as written in the Snapshot proposal, e.g., "42 - Project Name". The choice number prefix is part of the source string |
| `description` | YES | — | WEAK | Constructed as `"ENS Small Grants applicant in: {proposal_title}"` — this is not a description of the project; it is a description of the context in which the project was encountered. Snapshot choices are strings, not objects, so there is no project description field available at all in the source data |
| `contentURI` | YES | — | NULL | There is no URL associated with a Snapshot vote choice. The project cannot be linked to any external resource from the available source data. This is a required field with no source counterpart |
| `image` | OPTIONAL | — | NULL | No image available — Snapshot choices are plain text strings |
| `coverImage` | OPTIONAL | — | HARDCODED | `''` |
| `email` | OPTIONAL | — | HARDCODED | `''` |
| `socials` | OPTIONAL | — | HARDCODED | `[]` — no social links available from Snapshot choice data |
| `membersURI` | OPTIONAL | — | HARDCODED | `''` |
| `attestationIssuersURI` | OPTIONAL | — | HARDCODED | `[]` |
| `relevantTo` | OPTIONAL | — | HARDCODED | `[]` |
| `licenseURI` | OPTIONAL | — | HARDCODED | `''` |

**Project summary: 2/12 fields are column-backed (17%). `contentURI` (required) is NULL.**

Every ENS project record is essentially a name and an ID. No description, no URL, no social links,
no images, no contact information. This reflects the nature of Snapshot voting: choice strings
are text labels, not structured project profiles. The project data in the DAOIP-5 context is
a placeholder record that allows the application schema to exist — but the project schema cannot
be populated without ENS providing structured project profiles outside of Snapshot.

### GrantApplication

**NOT IMPLEMENTED.** No schema section exists in `daoip5_ens.yaml`. No `silver_ens_grant_applications` table is produced.

The ENS voting model does not map to the DAOIP-5 GrantApplication schema in any straightforward way:

| DAOIP-5 GrantApplication concept | ENS equivalent | Gap |
|---|---|---|
| Application submitted by a project | Vote choice added to Snapshot proposal | Choices are added by the proposal creator, not the project team |
| `createdAt` (when the application was made) | Proposal creation date — not per-choice | Cannot distinguish when each project "applied" |
| `fundsAsked` | None — no funding request in the voting model | Voters decide allocation without a request |
| `fundsApproved` | Could be approximated from vote scores | Requires ENS/USD price conversion at round close |
| `status` | Could derive from `scores[choice_index] > 0` | Very coarse — no in_review, pending, or completed states |
| `payoutAddress` | Not in Snapshot data | Would require cross-referencing ENS DNS or on-chain records |

The structural incompatibility is documented but not formally marked in the `daoip5_ens.yaml` manifest.
The manifest should include a `compatibility_note` field explaining why `grant_applications` is absent,
so that any future engineer who reads the YAML understands the deliberate design decision.

---

## Issue Register

### P0 — Fabricated Required Fields

These are the most critical findings. A fabricated required field is not simply missing — it
is actively incorrect. It causes silent data corruption in downstream aggregations.

| # | Source | Field | Schema | Fabricated Value | Downstream Impact |
|---|---|---|---|---|---|
| **P0-1** | ENS | `totalGrantPoolSizeInUSD` | GrantPool | `0.0` (literal constant) | All 24 ENS grant pool records report $0 in total funding. Any platform-level report that sums `totalGrantPoolSizeInUSD` across sources will silently omit the entire ENS historical allocation. The `gold__all_grant_pools` aggregation is wrong for every row sourced from ENS |
| **P0-2** | SCF | `createdAt` | GrantApplication | `'2025-01-01T00:00:00Z'` (literal constant) | Every SCF application record carries an identical creation timestamp. Funding trend charts, cohort analysis, and any time-series query over SCF applications will show all grants as submitted on a single date. The `gold__temporal_funding` and similar time-series models are corrupted for SCF |

### P1 — Data Present in Bronze Layer But Not Wired Into Silver

These gaps are fixable without obtaining new data from the source systems. The information
already exists in the pipeline; it is simply not connected to the right place.

| # | Source | Field | Schema | What exists | What's missing |
|---|---|---|---|---|---|
| **P1-1** | Gitcoin | `payouts` | GrantApplication | `bronze_gitcoin2_payouts` table, sourced from `applications_payouts.csv`, contains `application_id`, `round_id`, `transaction_hash`, `amount`, `amount_in_usd`, `token_address`, `timestamp`, `sender` for every disbursement event | An aggregation join in the silver transformation that groups payout records by `application_id` and writes the resulting array into the `payouts` field |
| **P1-2** | Gitcoin | `grantPoolName` | GrantApplication | `bronze_gitcoin2_rounds` table contains the round name inside `round_metadata.name` for every `round_id` | A join from `silver_gitcoin2_grant_applications` to `bronze_gitcoin2_rounds` on `round_id`, extracting the name |

### P2 — Semantic Mismatch (Wrong Source Column Used)

These fields are classified as SOURCE_MAPPED or COMPUTED in the coverage metrics because they
derive from a source column — but the source column being used is semantically incorrect for
the DAOIP-5 field it populates.

| # | Source | Field | Schema | What is currently written | What should be written | Why it matters |
|---|---|---|---|---|---|---|
| **P2-1** | Gitcoin | `email` | Project | `metadata.projectTwitter` (a Twitter/X handle such as `@gitcoinco`) | `null` — the metadata JSON does not contain an email address | Any feature that treats `email` as a contact email will silently use a social media handle. This inflates the source-mapped coverage metric without adding genuine email data |
| **P2-2** | SCF | `fundsAskedInUSD` | GrantApplication | `Total Awarded (USD)` — the approved/awarded amount | `null` — no "amount requested" field exists in the Airtable export | When `fundsAskedInUSD == fundsApprovedInUSD` for every record, it is impossible to compute approval rates or identify over/under-funded applications |
| **P2-3** | ENS | `applicationsURI` | GrantPool | Full proposal `body` markdown text (hundreds of characters of prose) | A URI pointing to the list of applicants — no such URI exists in Snapshot, but the proposal's own Snapshot URL can be constructed from the proposal `id` | A URI field containing free-form prose will break any client that attempts to dereference it as a link |
| **P2-4** | ENS | `description` | GrantPool | `"ENS Small Grants — {title}"` — a templated string that is functionally identical to `name` | The `body` field from the Snapshot proposal, which contains the actual round description | Two fields that should carry different information (`name` and `description`) carry the same information. The `body` field that could populate `description` meaningfully is instead (mis)used for `applicationsURI` |

### P3 — Structural and Coverage Gaps

These are limitations that require either changes to the source system's data collection
practices, or an explicit acknowledgment that the DAOIP-5 field cannot be populated for
this source.

| # | Source | Field / Schema | Notes |
|---|---|---|---|
| **P3-1** | SCF | `status` in GrantApplication | Only `"approved"` and `"pending"` are used. The Airtable view filters to awarded projects, so rejected and in-review applications are not present in the export. Accessing the full pipeline would require a different Airtable view that includes all submission statuses |
| **P3-2** | SCF | `payoutAddress` in GrantApplication | SCF pays via XLM and bank transfer. Stellar wallet addresses are not stored in Airtable. Collecting them would require a change to SCF's application intake form |
| **P3-3** | ENS | `contentURI` in Project | Snapshot vote choices are plain text strings with no associated URL. There is no project profile system in ENS Small Grants. A project that wants a `contentURI` would need to submit one through a separate metadata registry |
| **P3-4** | ENS | GrantApplication (entire schema) | Structurally incompatible — see full explanation in the ENS section above |
| **P3-5** | Gitcoin | `grantFundingMechanism` in GrantPool | The transform maps any `strategy_name` containing "Quadratic" to `"Quadratic Funding"` and anything else to `"Direct Grants"`. The DAOIP-5 spec recognizes 31 funding mechanisms including Streaming Quadratic Funding, Retro Funding, Bounties, and others. Gitcoin has used several of these in practice and they are being collapsed into two buckets |
| **P3-6** | SCF | `grantFundingMechanism` in GrantPool | SCF's process is multi-phase: abstract submission → initial review → panel review → community vote → award distribution. This is closer to `"Request for Proposal"` with a `"Ranked Choice Voting"` final stage than it is to `"Direct Grants"`, but neither value accurately captures the full process |

---

## Compliance Score Breakdown

### Scoring Model

| Field Category | Required field | Optional field | Reasoning |
|---|---|---|---|
| SOURCE_MAPPED | 3 pts | 1 pt | Column exists in source, transform uses it, output carries source information |
| COMPUTED | 2 pts | 1 pt | Output is data-driven but introduces transformation logic that adds maintenance risk |
| HARDCODED (accurate) | 1 pt | 0 pts | Value is correct but not from source — e.g., `grantFundingMechanism: 'Ranked Choice Voting'` for ENS |
| HARDCODED (fabricated) | 0 pts + P0 | 0 pts | Value is written as a constant that is factually incorrect |
| NULL | 0 pts | 0 pts | No source, no transform, field will be database NULL |

Max possible points per schema = (number of required fields × 3) + (number of optional fields × 1)

### Gitcoin 2.0

| Schema | Column-Backed | Hardcoded | NULL | Column-Backed % | Points |
|--------|--------------|-----------|------|-----------------|--------|
| GrantPool (15 fields) | 10 | 1 | 4 | 67% | 30/36 |
| Project (12 fields) | 11 | 2 | 1 | 92% | 13/16 |
| Application (20 fields) | 13 | 2 | 5 | 65% | 25/32 |
| **Total** | **34** | **5** | **10** | **72%** | **68/84** |

Required field failures: 0. No P0 issues.

### SCF (Stellar Community Fund)

| Schema | Column-Backed | Hardcoded | NULL | Column-Backed % | Points |
|--------|--------------|-----------|------|-----------------|--------|
| GrantPool (15 fields) | 9 | 5 | 1 | 60% | 27/36 |
| Project (12 fields) | 6 | 6 | 0 | 50% | 10/16 |
| Application (20 fields) | 11 | 8 | 1 | 55% | 21/32 |
| **Total** | **26** | **19** | **2** | **55%** | **58/84** |

Required field failures: 1 — `createdAt` hardcoded to `'2025-01-01T00:00:00Z'` (P0-2)

### ENS Small Grants

| Schema | Column-Backed | Hardcoded | NULL | Column-Backed % | Points |
|--------|--------------|-----------|------|-----------------|--------|
| GrantPool (15 fields) | 4 | 8 | 3 | 27% | 10/36 |
| Project (12 fields) | 2 | 8 | 2 | 17% | 3/16 |
| Application | NOT IMPLEMENTED | — | — | 0% | 0/32 |
| **Total** | **6** | **16** | **5** | **22%** | **13/84** |

Required field failures: 2 — `totalGrantPoolSizeInUSD` fabricated as `0.0` (P0-1), `contentURI` NULL (P3-3)

---

## Recommended Actions by Priority

### Immediate — P0 Corrections

**1. ENS `totalGrantPoolSizeInUSD`**
The current `0.0` must be replaced with either a computed USD equivalent or an explicit `null`.
The preferred fix: source ENS/USD price data at each round's `end_ts` date, multiply by the
total `scores_total` voting weight to derive a rough USD-equivalent pool size, and write that
computed value. If price sourcing is not feasible in the current pipeline, change the YAML map
to return `null` instead of `0.0`. A null will cause the field to be absent from aggregations
(which is correct behavior for unknown data) rather than contributing a fraudulent zero.

**2. SCF `createdAt`**
Request the Airtable API team to add `created_time` to the CSV export view for `Awarded Submissions`.
Airtable records expose this field natively — it is a configuration change in the export, not a
schema change. Alternatively, modify the SCF bronze asset to use the Airtable API directly rather
than a CSV export, where `created_time` is always available. As a short-term approximation,
`Submission Open Date` from the rounds table can be used as a per-round lower bound on `createdAt`.

### Short-Term — P1 Connections

**3. Gitcoin `payouts`**
Join `bronze_gitcoin2_payouts` into `silver_gitcoin2_grant_applications`. Group by `application_id`,
aggregate payout records into a JSON array per DAOIP-5's `payouts` array schema. The bronze
table is already populated — this is a dbt model or silver asset change only.

**4. Gitcoin `grantPoolName`**
Add a left join from the applications silver transformation to `bronze_gitcoin2_rounds` on `round_id`,
extracting `round_metadata.name` via JSON parse. Alternatively, add a lookup dictionary pass in the
`build_silver()` function. This is a one-line schema map addition with a lookup join.

**5. SCF `applicationCompletionRate`**
The `Tranche Completion %` column is already in the bronze SCF submissions table. The YAML schema
map writes `0.0` instead of reading it. Update `daoip5_scf.yaml` to map `applicationCompletionRate`
to `Tranche Completion %` with a percentage-to-float transform (e.g., `"33%"` → `0.33`).

### Medium-Term — P2 Semantic Corrections

**6. Gitcoin `email`**
Remove the `metadata.projectTwitter` mapping from the `email` field. Set `source: null` and
remove the transform. The field will become NULL, which is the honest representation of
"no email address is available in this source."

**7. ENS `description` and `applicationsURI`**
Swap the source fields:
- `description` should use `body` (the actual proposal description text)
- `applicationsURI` should either be constructed from the proposal `id` as a Snapshot URL
  (e.g., `https://snapshot.org/#/small-grants.eth/proposal/{id}`) or set to NULL

**8. SCF `fundsAskedInUSD`**
Remove the mapping to `Total Awarded (USD)`. Set `source: null`. The field will become NULL,
which correctly communicates that no "requested amount" data was collected by SCF.

### Long-Term — P3 Structural Improvements

**9. ENS grant application schema**
Add a `compatibility_note` to the `daoip5_ens.yaml` manifest explaining why `grant_applications`
is not implemented. Consider whether vote score data can be surfaced as a synthetic application
schema: each `(proposal_id, choice_number)` pair that received non-zero votes could be modeled
as a `GrantApplication` with `status: funded` and `fundsApproved` derived from the vote score
converted to USD.

**10. SCF and Gitcoin `grantFundingMechanism`**
Expand the mechanism mapping tables for both sources to cover a broader range of the DAOIP-5
recognized mechanisms rather than collapsing everything into two values.

---

*Report generated from schema map static analysis.*
*Re-run: `python3 scripts/daoip5_compliance_check.py`*
*Next scheduled re-run: after any schema map update or new snapshot ingestion.*
