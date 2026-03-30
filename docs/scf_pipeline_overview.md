# Opengrants <> Stellar Community Fund Pipeline

This document outlines the end-to-end process for converting SCF grant data into standardized DAOIP-5 format and computing analytics on the normalized data.

---

## Airtable Sensor Integration

The SCF pipeline is **event-driven via a Dagster record-count polling sensor** (`og_dagster/sensors/scf_sensor.py`). This replaces a prior webhook-based approach that required creator-level Airtable access not available with the current API token.

### How It Works

Every **2 minutes**, the sensor fetches record IDs from all three SCF Airtable tables and computes an MD5 fingerprint across the combined result. If the fingerprint differs from the last recorded state, the full SCF ETL pipeline (`etl_scf_full_job`: bronze → silver → gold) is triggered automatically.

| Property | Value |
| --- | --- |
| **Poll interval** | Every 2 minutes (`minimum_interval_seconds=120`) |
| **Change detection** | MD5 fingerprint over record IDs + counts across all 3 tables |
| **Trigger** | `etl_scf_full_job` — full bronze → silver → gold run |
| **Maximum end-to-end lag** | 10–15 minutes (poll interval + pipeline execution time) |
| **First-run behaviour** | Records baseline fingerprint, does not trigger — fires on the next detected change |
| **State persistence** | Dagster cursor (JSON) — survives restarts |
| **Failure handling** | Airtable fetch errors yield `SkipReason`, do not crash the sensor |

### What Triggers a Pipeline Run

A run is triggered whenever the total set of record IDs across any of the three tables changes — this covers:

- A new round being created in `Build Award Rounds`
- A new submission added to `Awarded Submissions [Build Only]`
- A new project added to `Awarded Projects [Build Only]`
- An existing record being deleted from any of the above

Changes to **field values within existing records** (e.g., updating an award amount) do not trigger the sensor, since the fingerprint is based on record IDs and counts only. These changes are picked up on the next scheduled manual snapshot export.

### Sensor Location

- **File**: `og_dagster/sensors/scf_sensor.py`
- **Registered in**: `og_dagster/sensors/__init__.py`

---

## Pipeline Overview

### Step 1: Source Data Extraction

- **Source**: Airtable Base
- **URL**: https://airtable.com/app8tLjMIDrjeloWN/shrrNA24K1e0v5Q0R/tbl57OROvn0qQTuiP/viwNf0pOvzy89J0EB
- **Tables Extracted**:
  - Build Award Rounds
  - Awarded Submissions [Build Only]
  - Awarded Projects [Build Only]
- **Output**: CSV files for each table

### Step 2: File Organization

- Save all extracted files to date-stamped folders (e.g., `YYYY_MM_DD`)
- Maintains data versioning and audit trail
- **Storage**: https://github.com/metagov/opengrants-platform/tree/master/raw_data/SCF/11_November_2025

---

## Data Processing Architecture

### Medallion (Bronze–Silver–Gold) Model

#### Bronze Layer — Raw Data

- **Purpose**: Direct ingestion from source systems
- **Sources**: Airtable APIs, CSV exports
- **Storage**: PostgreSQL raw tables
- **Characteristics**: No cleaning or normalization
- **Examples**: `bronze_scf_rounds`, `bronze_scf_submissions`

#### Silver Layer — Cleaned & Normalized Data

- **Purpose**: Standardize schema to [DAOIP-5 specification](https://github.com/metagov/daostar)
- **Transformations**: Type enforcement, relationship mapping, metadata quality
- **Storage**: PostgreSQL normalized tables
- **Output**: DAOIP-5 compliant datasets

#### Gold Layer — Analytics & Metrics

- **Purpose**: Cross-ecosystem analytics and aggregated metrics
- **Storage**: DuckDB for high-performance querying
- **Use Cases**: Dashboard integration, funding trend analysis, ecosystem comparisons

---

## Implementation Steps

### Step 3: Bronze Ingestion

- **Script**: `scf.py`
- **Location**: https://github.com/metagov/opengrants-platform/blob/master/og_dagster/assets/bronze/scf.py
- **Function**: Ingests raw SCF data into bronze layer

### Step 4: Silver Normalization

- **Schema Mapping**: Defined in YAML configuration
- **Config File**: https://github.com/metagov/opengrants-platform/blob/master/og_dagster/configs/schema_maps/active/daoip5_scf.yaml
- **Function**: Transforms bronze data to DAOIP-5 standard

### Step 5: Gold Metrics Computation

- **Models**: https://github.com/metagov/opengrants-platform/tree/master/dbt_project/models/gold
- **Metrics**: https://github.com/metagov/opengrants-platform/tree/master/dbt_project/models/gold/metrics
- **Function**: Computes analytical metrics from normalized data

---

## Standard Metrics & Reporting

### Common Metrics (All Grant Programs)

- **Program Identity**: Name, Description, Active Since
- **Funding Overview**: Total Funds Distributed, Total Applications Awarded
- **Project Analysis**: Top 10 Projects Funded, Projects funded by round and time period
- **Program Details**: Grant Program Overview, Latest round, Grant procedure, Contact information, Additional links

### Stellar Community Fund Specific Metrics

- **Financial Tracking**: Total Awarded vs Total Paid
- **Quarterly Analytics**:
  - Quarterly Projects Awarded
  - Quarterly Funding Distribution (XLM denominated in USD)
- **Round Analysis**: Awarded Submissions by round
- **Category Insights**: Awarded projects by category
- **Currency Highlight**: XLM as native currency emphasis

---

## For SCF Team Review

We'd appreciate your feedback on:

1. Should we adjust any field definitions?
2. Are there any process improvements we can make towards the clarity or efficiency of the data pipeline?
3. What funding metrics or performance insights (including those from other grant programs) would be most valuable for decision making within the SCF program and throughout the Stellar funding ecosystem?

We'd appreciate some clarity on:

1. What tools other than Airtable are used in the SCF grant management process?
2. How are milestones tracked for SCF grantees?
3. What is the process of milestone verification?

This pipeline ensures your grant data is standardized and ready for cross-ecosystem analysis while maintaining SCF-specific reporting requirements.

---

## DAOIP-5 Compliance Assessment

As of March 2026, SCF data is assessed under two complementary compliance frameworks.

**Round-level indexing compliance** measures how many SCF grant rounds are successfully indexed and available in DAOIP-5. SCF achieves **100% compliance across all 40 finished rounds** (SCF #1–#40) — every completed cohort is translated into a DAOIP-5 `GrantPool` record with name, dates, funding, and submission data intact.

**Field-level schema compliance** measures how many DAOIP-5 fields within those records are populated from genuine Airtable source columns vs hardcoded placeholders. The reassessed results, focused on required fields:

| Schema | Required Fields | Passing | Rate |
| --- | --- | --- | --- |
| GrantPool | 6 | 6 | **100%** |
| Project | 4 | 4 | **100%** |
| GrantApplication | 4 | 3 | **75%** — 1 P0 issue |
| **Overall required** | **14** | **13** | **93%** |

**Overall source-column-backed coverage (required + optional):** 55%

The single open issue blocking 100% required-field compliance is a P0 on `createdAt` in `GrantApplication` — every submission record carries a hardcoded `'2025-01-01T00:00:00Z'` timestamp because the Airtable CSV export does not include per-record creation timestamps. See the recommendation below.

Full methodology — including field classification, scoring model, P0–P3 definitions, and replication instructions:

**[docs/compliance/daoip5_assessment_methodology.md](https://github.com/metagov/opengrants-platform/blob/master/docs/compliance/daoip5_assessment_methodology.md)**

Full field-level detail report:

**[docs/compliance/daoip5_compliance_report_2026-03-31.md](https://github.com/metagov/opengrants-platform/blob/master/docs/compliance/daoip5_compliance_report_2026-03-31.md)**

---

## Recommendation: Reaching 100% Required Field Compliance

One change closes the gap.

### Fix `createdAt` — P0 (blocks 100% required field compliance)

**Current state:** `createdAt` in `silver_scf_grant_applications` is hardcoded:

```yaml
createdAt:
  source: null
  type: datetime
  transform: "lambda _: '2025-01-01T00:00:00Z'"
```

Every SCF submission record carries `2025-01-01T00:00:00Z` regardless of when it was actually submitted. This makes time-series analysis, application velocity tracking, and cohort reporting on SCF data unreliable.

**Why it's missing:** The current SCF ingestion reads from CSV exports (`Build Award Rounds-By Year_DATE.csv`, etc.). These CSVs are manual exports from Airtable views and do not include the `created_time` metadata field that Airtable attaches to every record.

**The fix:** The Airtable API already exposes `createdTime` on every record. The sensor infrastructure (`og_dagster/sensors/scf_sensor.py`) already authenticates against the Airtable API using `AIRTABLE_API_KEY`. Switching the bronze `Awarded Submissions` ingestion from CSV to API-based fetching via `fetch_airtable_table` (already used in the sensor) will surface `createdTime` per submission record.

**Changes required:**

1. **Bronze asset (`og_dagster/assets/bronze/scf.py`):** Add `createdTime` to the fields fetched from the `Awarded Submissions [Build Only]` table, or switch that table's ingestion from CSV to `fetch_airtable_table`. Store as `created_time` in `bronze_scf_submissions`.

2. **Silver schema map (`og_dagster/configs/schema_maps/active/daoip5_scf.yaml`):** Update the `createdAt` field mapping:

```yaml
# Before
createdAt:
  source: null
  type: datetime
  transform: "lambda _: '2025-01-01T00:00:00Z'"

# After
createdAt:
  source: "created_time"
  type: datetime
  required: true
```

3. **YAML governance fix:** While updating the schema map, set `required: true` on `contentURI` in the `projects` schema — it is a DAOIP-5 required field currently without a `required` flag, meaning the pipeline will not catch it going NULL.

**Expected outcome after fix:**

| Schema | Required Fields | Passing | Rate |
| --- | --- | --- | --- |
| GrantPool | 6 | 6 | **100%** |
| Project | 4 | 4 | **100%** |
| GrantApplication | 4 | 4 | **100%** |
| **Overall required** | **14** | **14** | **100%** |

---

## Compliance Report

| Ecosystem | Snapshot Date | Total Rounds | Compliant Rounds | Compliance Rate | Total Funding (Compliant Rounds) |
| --- | --- | --- | --- | --- | --- |
| **SCF** | Mar 23, 2026 | 48 (40 finished, 1 in-progress, 7 future) | 40 finished | **100% of finished rounds** | $52,064,066.01 awarded / $48,195,424.76 paid |
| **ENS Small Grants** | Mar 24, 2026 | 24 | 24 | **100.0%** | 20,313,064.17 ENS voting power* |
| **Gitcoin 2.0** | Mar 17, 2026 | 2,330 | 914† | **39.2%†** | $106.4M match pool (287 rounds with donor activity) |

\* ENS funding is denominated in ENS token voting weight, not USD. A USD equivalent is not available from the source data.
† The 914 figure counts all rounds with an indexable round name. 1,416 rounds have no round name in metadata and cannot be indexed. 287 rounds have genuine donor activity.

*For full round-by-round detail see: `docs/compliance/daoip5_round_compliance_report_2026-03-31.md`*
