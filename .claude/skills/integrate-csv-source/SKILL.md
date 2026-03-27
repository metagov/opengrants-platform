---
name: integrate-csv-source
description: |
  Integrate a new CSV data source into the OpenGrants platform. This skill guides you through
  the complete workflow for adding a new data source following the Bronze → Silver → Gold
  medallion architecture.
  
  Use when the user says:
  - "add a new CSV source"
  - "integrate a new data source"
  - "add {source} to the platform"
  - "create a new bronze/silver pipeline"
---

# Integrate New CSV Data Source

Complete workflow for adding a new CSV-based data source to the OpenGrants platform.

## Prerequisites

1. CSV files from the source system are available
2. You have identified the source system name (e.g., "Gitcoin2", "AlloProtocol")
3. You have access to the repository

## Step-by-Step Checklist

### Step 1: Analyze the CSV Structure

Before writing any code, examine the CSV files to understand:
- Column names and data types
- Entity relationships (rounds, projects, applications, donations, payouts)
- Which columns map to DAOIP-5 standard fields
- Any JSON-embedded fields that need parsing

```bash
# Check CSV structure
head -5 /path/to/your/source/rounds.csv
head -5 /path/to/your/source/projects.csv
head -5 /path/to/your/source/applications.csv

# Count rows
wc -l /path/to/your/source/*.csv
```

### Step 2: Create Bronze Loader

**File:** `og_dagster/assets/bronze/{source}.py`

```python
# og_dagster/assets/bronze/gitcoin2.py
"""
Bronze layer loader for {SourceName}.

Reads CSV files from {SOURCE}_RAW_DATA_DIR and loads them into Postgres
as bronze_{source}_* tables.
"""

import os
from pathlib import Path
import polars as pl
from dagster import AssetOut, Output, get_dagster_logger, multi_asset
from sqlalchemy import create_engine

from utils.graphql_helpers import (
    POSTGRES_DB, POSTGRES_HOST, POSTGRES_PASSWORD, POSTGRES_PORT, POSTGRES_USER,
)

logger = get_dagster_logger()

# CONFIGURATION
{SOURCE}_RAW_DATA_DIR = os.getenv("{SOURCE}_RAW_DATA_DIR", "/app/raw_data/{SourceName}/...")
DB_URL = (
    f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)
engine = create_engine(DB_URL)

# TABLE MAP: (csv_filename, table_name, stream_large)
# Set stream_large=True for files with 100k+ rows
CSV_TABLE_MAP = [
    ("rounds.csv",       "bronze_{source}_rounds",       False),
    ("projects.csv",     "bronze_{source}_projects",      False),
    ("applications.csv", "bronze_{source}_applications",  False),
    ("donations.csv",    "bronze_{source}_donations",    True),  # Stream large files
    ("applications_payouts.csv", "bronze_{source}_payouts", False),
    ("attestations.csv", "bronze_{source}_attestations", False),
]

STREAM_BATCH_SIZE = 50_000

def _sanitize_df(df: pl.DataFrame) -> pl.DataFrame:
    """Cast all columns to Utf8 (string) so Postgres accepts any value."""
    return df.with_columns([pl.col(c).cast(pl.Utf8) for c in df.columns])

def _load_csv(path: Path) -> pl.DataFrame:
    return pl.read_csv(
        path,
        infer_schema_length=0,   # All columns as strings
        truncate_ragged_lines=True,
        ignore_errors=True,
    )

def _write_df(df: pl.DataFrame, table_name: str, replace: bool) -> int:
    mode = "replace" if replace else "append"
    df.write_database(table_name=table_name, connection=engine, if_table_exists=mode)
    return len(df)

def _load_and_write_small(csv_path: Path, table_name: str) -> int:
    df = _sanitize_df(_load_csv(csv_path))
    return _write_df(df, table_name, replace=True)

def _load_and_write_large(csv_path: Path, table_name: str) -> int:
    """Stream CSV in batches for 100k+ row files."""
    total = 0
    first = True
    for batch_df in pl.read_csv_batched(
        csv_path, infer_schema_length=0, truncate_ragged_lines=True,
        ignore_errors=True, batch_size=STREAM_BATCH_SIZE,
    ).next_batches(10_000):
        if batch_df is None or len(batch_df) == 0:
            break
        df = _sanitize_df(batch_df)
        total += _write_df(df, table_name, replace=first)
        first = False
    return total

@multi_asset(
    outs={
        f"bronze__{source}_rounds": AssetOut(
            metadata={"description": "{SourceName} grant rounds from CSV"},
            tags={"layer": "bronze", "source": "{source}", "domain": "grants"},
        ),
        f"bronze__{source}_projects": AssetOut(
            metadata={"description": "{SourceName} projects from CSV"},
            tags={"layer": "bronze", "source": "{source}", "domain": "grants"},
        ),
        # ... add one AssetOut per table
    },
    compute_kind="csv",
    group_name="bronze_{source}",
)
def load_{source}_csv_data():
    data_dir = Path({SOURCE}_RAW_DATA_DIR)
    if not data_dir.exists():
        raise FileNotFoundError(f"{SOURCE}_RAW_DATA_DIR not found: {data_dir}")

    counts = {}
    for csv_file, table_name, stream_large in CSV_TABLE_MAP:
        csv_path = data_dir / csv_file
        if not csv_path.exists():
            logger.warning(f"File not found, skipping: {csv_path}")
            counts[table_name] = 0
            continue
        
        if stream_large:
            counts[table_name] = _load_and_write_large(csv_path, table_name)
        else:
            counts[table_name] = _load_and_write_small(csv_path, table_name)

    # Yield Output for each table
    yield Output(
        pl.read_database(f"SELECT * FROM bronze_{source}_rounds LIMIT 5", engine),
        f"bronze__{source}_rounds",
        metadata={"row_count": counts.get(f"bronze_{source}_rounds", 0)},
    )
    # ... yield outputs for all tables
```

### Step 3: Create Schema Map YAML

**File:** `og_dagster/configs/schema_maps/active/daoip5_{source}.yaml`

**IMPORTANT:** After creating this file, you MUST validate it against the schema manifest:

```bash
yamale -s og_dagster/configs/schema_maps/schema_manifest.yaml \
    og_dagster/configs/schema_maps/active/daoip5_{source}.yaml
```

If validation fails, fix the YAML structure before proceeding.

```yaml
# ============================================================
# DAOIP-5 Unified Schema Map — {SourceName}
# ============================================================

manifest:
  schema_name: daoip5_{source}
  version: 1.0.0
  source_system: "{SourceName} CSV Snapshot"
  last_updated: "{YYYY-MM-DD}"

schemas:

  # ----------------------------------------------------------
  # GrantPool Schema (Rounds)
  # ----------------------------------------------------------
  grant_pools:
    table: bronze_{source}_rounds
    target_table: silver_{source}_grant_pools

    fields:
      id:
        source: id
        type: string
        required: true
        transform: "lambda v: f'daoip-5:{source}:grantPool:{v}' if v else None"

      name:
        source: name
        type: string
        required: true

      description:
        source: description
        type: string
        required: false

      grantFundingMechanism:
        source: strategy_type
        type: enum
        allowed:
          - "Quadratic Funding"
          - "Direct Grants"
          - "Retro Funding"
        transform: "lambda v: v or 'Direct Grants'"

      isOpen:
        source: is_active
        type: boolean

      closeDate:
        source: end_date
        type: datetime

      totalGrantPoolSizeInUSD:
        source: matching_pool_usd
        type: float

      applicationsURI:
        source: application_url
        type: string

      coverImage:
        source: null
        type: string
        transform: "lambda _: ''"

      email:
        source: null
        type: string
        transform: "lambda _: ''"

      governanceURI:
        source: null
        type: string
        transform: "lambda _: ''"

      attestationIssuersURI:
        source: null
        type: string
        transform: "lambda _: ''"

      requiredCredentials:
        source: null
        type: json
        transform: "lambda _: []"

      totalGrantPoolSize:
        source: matching_pool_amount
        type: json
        transform: "lambda v: [{'amount': float(v) if v else 0, 'denomination': 'USD'}]"

    extensions:
      io.{source}:
        chainId:
          source: chain_id
          type: integer
          required: true

        # Add all raw columns here for auditing
        raw_field_1:
          source: raw_column_name
          type: string

  # ----------------------------------------------------------
  # Project Schema
  # ----------------------------------------------------------
  projects:
    table: bronze_{source}_projects
    target_table: silver_{source}_projects

    fields:
      id:
        source: id
        type: string
        required: true
        transform: "lambda v: f'daoip-5:{source}:project:{v}' if v else None"

      name:
        source: project_name
        type: string
        required: true

      description:
        source: description
        type: string

      contentURI:
        source: website_url
        type: string

      email:
        source: contact_email
        type: string

      image:
        source: logo_url
        type: string

      coverImage:
        source: banner_url
        type: string

      licenseURI:
        source: null
        type: string
        transform: "lambda _: ''"

      relevantTo:
        source: null
        type: json
        transform: "lambda _: []"

      socials:
        source: null
        type: json
        transform: "lambda _: []"

      membersURI:
        source: team_url
        type: string

      attestationIssuersURI:
        source: null
        type: json
        transform: "lambda _: []"

    extensions:
      io.{source}:
        chainId:
          source: chain_id
          type: integer

  # ----------------------------------------------------------
  # GrantApplication Schema
  # ----------------------------------------------------------
  grant_applications:
    table: bronze_{source}_applications
    target_table: silver_{source}_grant_applications

    fields:
      id:
        source: id
        type: string
        required: true
        transform: "lambda v: f'daoip-5:{source}:grantApplication:{v}' if v else None"

      name:
        source: application_title
        type: string
        required: true

      grantPoolId:
        source: round_id
        type: string
        required: true
        transform: "lambda v: f'daoip-5:{source}:grantPool:{v}' if v else None"

      grantPoolName:
        source: round_name
        type: string

      projectId:
        source: project_id
        type: string
        transform: "lambda v: f'daoip-5:{source}:project:{v}' if v else None"

      createdAt:
        source: created_at
        type: datetime
        required: true

      description:
        source: description
        type: string

      contentURI:
        source: application_url
        type: string

      status:
        source: status
        type: enum
        allowed:
          - "pending"
          - "approved"
          - "rejected"
          - "funded"
        transform: "lambda v: v.lower() if v else 'pending'"

      fundsAsked:
        source: amount_requested
        type: json
        transform: "lambda v: [{'amount': float(v), 'denomination': 'USD'}] if v else []"

      fundsAskedInUSD:
        source: amount_requested
        type: float

      fundsApproved:
        source: amount_approved
        type: json
        transform: "lambda v: [{'amount': float(v), 'denomination': 'USD'}] if v else []"

      fundsApprovedInUSD:
        source: amount_approved
        type: float

      payoutAddress:
        source: payout_wallet
        type: json
        transform: "lambda v: {'type': 'EthereumAddress', 'value': v} if v else None"

      payouts:
        source: null
        type: json
        transform: "lambda _: []"

      discussionTo:
        source: null
        type: string
        transform: "lambda _: ''"

      licenseURI:
        source: null
        type: string
        transform: "lambda _: ''"

      isInactive:
        source: status
        type: boolean
        transform: "lambda v: v in ['REJECTED', 'CANCELLED'] if v else False"

      applicationCompletionRate:
        source: null
        type: float
        transform: "lambda _: 0.0"

      socials:
        source: null
        type: json
        transform: "lambda _: []"

    extensions:
      io.{source}:
        chainId:
          source: chain_id
          type: integer

  # ----------------------------------------------------------
  # Donations Schema (if applicable)
  # ----------------------------------------------------------
  donations:
    table: bronze_{source}_donations
    target_table: silver_{source}_donations

    fields:
      id:
        source: id
        type: string
        required: true
        transform: "lambda v: f'daoip-5:{source}:donation:{v}' if v else None"

      grantPoolId:
        source: round_id
        type: string
        transform: "lambda v: f'daoip-5:{source}:grantPool:{v}' if v else None"

      applicationId:
        source: application_id
        type: string
        transform: "lambda v: f'daoip-5:{source}:application:{v}' if v else None"

      projectId:
        source: project_id
        type: string
        transform: "lambda v: f'daoip-5:{source}:project:{v}' if v else None"

      donorAddress:
        source: donor_address
        type: string

      recipientAddress:
        source: recipient_address
        type: string

      amount:
        source: amount
        type: float

      amountInUsd:
        source: amount_usd
        type: float

      timestamp:
        source: created_at
        type: datetime

      transactionHash:
        source: tx_hash
        type: string

    extensions:
      io.{source}:
        chainId:
          source: chain_id
          type: integer

  # ----------------------------------------------------------
  # Payouts Schema (if applicable)
  # ----------------------------------------------------------
  payouts:
    table: bronze_{source}_payouts
    target_table: silver_{source}_payouts

    fields:
      id:
        source: id
        type: string
        required: true
        transform: "lambda v: f'daoip-5:{source}:payout:{v}' if v else None"

      type:
        source: null
        type: string
        transform: "lambda _: 'OnchainTransaction'"

      applicationId:
        source: application_id
        type: string
        transform: "lambda v: f'daoip-5:{source}:application:{v}' if v else None"

      grantPoolId:
        source: round_id
        type: string
        transform: "lambda v: f'daoip-5:{source}:grantPool:{v}' if v else None"

      amount:
        source: amount
        type: float

      amountInUsd:
        source: amount_usd
        type: float

      sender:
        source: sender_address
        type: string

      tokenAddress:
        source: token_address
        type: string

      timestamp:
        source: created_at
        type: datetime

      proof:
        source: tx_hash
        type: string

    extensions:
      io.{source}:
        chainId:
          source: chain_id
          type: integer

meta:
  daoip_version: 5
  author: "{Your Name}"
  mapping_strategy: "DAOIP-5 compliant + io.{source} extensions"
  validation_rules:
    json_fields_must_parse: true
    id_format: "daoip-5:{source}"
    enum_enforced: true
    required_fields:
      - id
      - name
```

### Step 4: Validate Schema Map

**REQUIRED:** Run Yamale validation before proceeding:

```bash
yamale -s og_dagster/configs/schema_maps/schema_manifest.yaml \
    og_dagster/configs/schema_maps/active/daoip5_{source}.yaml
```

If this fails with errors, fix the YAML before continuing.

### Step 5: Create Silver Assets

**File:** `og_dagster/assets/silver/{source}/{source}.py`

```python
# og_dagster/assets/silver/gitcoin2/gitcoin2.py
"""
Silver layer assets for {SourceName} (CSV snapshot).

Transforms bronze CSV tables to DAOIP-5 compliant silver tables.
"""

from dagster import Output, asset
from utils.db import drop_dependent_views
from utils.translate_to_silver import build_silver

SCHEMA_PATH = "/app/configs/schema_maps/active/daoip5_{source}.yaml"


@asset(
    name="silver__{source}_grant_pools",
    description="DAOIP-5 compliant GrantPool schema for {SourceName}",
    required_resource_keys={"database_engine"},
    deps=["bronze__{source}_rounds"],
    compute_kind="transformation",
    group_name="silver_{source}",
)
def silver_{source}_grant_pools(context):
    engine = context.resources.database_engine
    df_silver = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="grant_pools")
    drop_dependent_views(engine, "silver_{source}_grant_pools", context)
    df_silver.write_database(table_name="silver_{source}_grant_pools", connection=engine, if_table_exists="replace")
    return Output(df_silver)


@asset(
    name="silver__{source}_projects",
    description="DAOIP-5 compliant Project schema for {SourceName}",
    required_resource_keys={"database_engine"},
    deps=["bronze__{source}_projects"],
    compute_kind="transformation",
    group_name="silver_{source}",
)
def silver_{source}_projects(context):
    engine = context.resources.database_engine
    df_silver = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="projects")
    drop_dependent_views(engine, "silver_{source}_projects", context)
    df_silver.write_database(table_name="silver_{source}_projects", connection=engine, if_table_exists="replace")
    return Output(df_silver)


@asset(
    name="silver__{source}_grant_applications",
    description="DAOIP-5 compliant GrantApplication schema for {SourceName}",
    required_resource_keys={"database_engine"},
    deps=["bronze__{source}_applications"],
    compute_kind="transformation",
    group_name="silver_{source}",
)
def silver_{source}_grant_applications(context):
    engine = context.resources.database_engine
    df_silver = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="grant_applications")
    drop_dependent_views(engine, "silver_{source}_grant_applications", context)
    df_silver.write_database(table_name="silver_{source}_grant_applications", connection=engine, if_table_exists="replace")
    return Output(df_silver)


@asset(
    name="silver__{source}_donations",
    description="DAOIP-5 compatible donations for {SourceName}",
    required_resource_keys={"database_engine"},
    deps=["bronze__{source}_donations"],
    compute_kind="transformation",
    group_name="silver_{source}",
)
def silver_{source}_donations(context):
    engine = context.resources.database_engine
    df_silver = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="donations")
    drop_dependent_views(engine, "silver_{source}_donations", context)
    df_silver.write_database(table_name="silver_{source}_donations", connection=engine, if_table_exists="replace")
    return Output(df_silver)


@asset(
    name="silver__{source}_payouts",
    description="DAOIP-5 compliant payouts for {SourceName}",
    required_resource_keys={"database_engine"},
    deps=["bronze__{source}_payouts"],
    compute_kind="transformation",
    group_name="silver_{source}",
)
def silver_{source}_payouts(context):
    engine = context.resources.database_engine
    df_silver = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="payouts")
    drop_dependent_views(engine, "silver_{source}_payouts", context)
    df_silver.write_database(table_name="silver_{source}_payouts", connection=engine, if_table_exists="replace")
    return Output(df_silver)
```

### Step 6: Register in Definitions

**File:** `og_dagster/definitions.py`

```python
# --- Bronze Assets ---
from assets.bronze.{source} import load_{source}_csv_data

# --- Silver Assets ---
from assets.silver.{source}.{source} import (
    silver_{source}_grant_pools,
    silver_{source}_projects,
    silver_{source}_grant_applications,
    silver_{source}_donations,
    silver_{source}_payouts,
)

# Bronze Job
bronze_{source}_job = define_asset_job(
    name="bronze_{source}_job",
    selection=AssetSelection.assets(load_{source}_csv_data),
    description="Load {SourceName} CSV data into Bronze layer.",
)

# Silver Job
silver_{source}_etl_job = define_asset_job(
    name="silver_{source}_etl_job",
    selection=AssetSelection.assets(
        silver_{source}_grant_pools,
        silver_{source}_projects,
        silver_{source}_grant_applications,
        silver_{source}_donations,
        silver_{source}_payouts,
    ),
    description="Transform {SourceName} data into Silver layer.",
)

# Add to all_jobs and all_asset_checks in Definitions
```

### Step 7: Add dbt Source

**File:** `dbt_project/models/sources.yml`

```yaml
sources:
  - name: silver
    schema: public
    tables:
      # ... existing sources ...
      # {SourceName}
      - name: silver_{source}_grant_pools
      - name: silver_{source}_projects
      - name: silver_{source}_grant_applications
      - name: silver_{source}_donations
      - name: silver_{source}_payouts
```

### Step 8: Create dbt Gold Metrics (Optional)

**Directory:** `dbt_project/models/gold/metrics/{source}/`

```sql
-- dbt_project/models/gold/metrics/{source}/gold__{source}_round_metrics.sql
{{ config(materialized='table', tags=['gold']) }}

SELECT
    gp.id as round_id,
    gp.name as round_name,
    gp."grantFundingMechanism" as funding_mechanism,
    gp."totalGrantPoolSizeInUSD"::numeric as matching_pool_usd,
    gp."io.{source}.chainId" as chain_id,
    -- Add your analytics columns here
FROM {{ source('silver', 'silver_{source}_grant_pools') }} gp
```

## Validation Checklist

Before marking the integration complete, verify:

- [ ] Yamale schema validation passes: `yamale -s og_dagster/configs/schema_maps/schema_manifest.yaml og_dagster/configs/schema_maps/active/daoip5_{source}.yaml`
- [ ] Bronze loader runs without errors
- [ ] Bronze tables exist in Postgres: `\dt bronze_{source}_*`
- [ ] Silver transformation runs without errors
- [ ] Silver tables exist with DAOIP-5 IDs: `SELECT id FROM silver_{source}_grant_pools LIMIT 5;`
- [ ] dbt sources are recognized: `dbt ls --resource-type=source`
- [ ] dbt models compile: `dbt compile`

## DAOIP-5 ID Format Convention

```
daoip-5:{source}:project:{id}
daoip-5:{source}:grantPool:{id}
daoip-5:{source}:grantApplication:{id}
daoip-5:{source}:donation:{id}
daoip-5:{source}:payout:{id}
```

## Naming Conventions

| Layer | Prefix | Example |
|-------|--------|---------|
| Bronze | `bronze__` + `bronze_{source}_` | `bronze__gitcoin2_rounds` |
| Silver | `silver__` + `silver_{source}_` | `silver__gitcoin2_grant_pools` |
| Gold | `gold__` + `{source}_` | `gold__gitcoin2_round_metrics` |

## Environment Variables

| Variable | Description |
|----------|-------------|
| `{SOURCE}_RAW_DATA_DIR` | Path to CSV files (e.g., `/app/raw_data/Gitcoin/17_March_2026`) |

## File Checklist

```
og_dagster/
├── assets/
│   ├── bronze/
│   │   └── {source}.py              # Bronze loader
│   └── silver/
│       └── {source}/
│           └── {source}.py          # Silver transformer
├── configs/
│   └── schema_maps/
│       └── active/
│           └── daoip5_{source}.yaml # Schema mapping (MUST validate with yamale)
│       └── schema_manifest.yaml     # Yamale schema for validation
└── definitions.py                   # Register assets + jobs

dbt_project/
└── models/
    ├── sources.yml                  # Add dbt source
    └── gold/
        └── metrics/
            └── {source}/            # Gold dbt models (optional)
```

## Troubleshooting

### Yamale Validation Fails

Check the error message for specific field issues. Common problems:
- Missing required field (check `required: true`)
- Wrong type (check `type: enum('string')` vs `type: string`)
- Invalid extension namespace (must start with `io.`, `org.`, `com.`, `x-`, `ethereum.`, or `stellar.`)

### Bronze Tables Not Loading

1. Check CSV path exists: `ls -la $GITCOIN2_RAW_DATA_DIR`
2. Check CSV files are named correctly (case-sensitive)
3. Check Postgres connection in utils/graphql_helpers

### Silver Transformation Fails

1. Verify bronze tables have data: `SELECT COUNT(*) FROM bronze_{source}_rounds;`
2. Check YAML field names match exactly with bronze column names
3. Verify transform lambdas are syntactically correct
