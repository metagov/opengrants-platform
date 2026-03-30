# og_dagster/assets/bronze/gitcoin2.py
"""
Bronze layer loader for Gitcoin 2.0 CSV snapshot.

Reads CSV files from GITCOIN2_RAW_DATA_DIR and loads them into Postgres
as bronze_gitcoin2_* tables using COPY FROM STDIN for fast bulk ingestion.

CSV Files:
- rounds.csv               -> bronze_gitcoin2_rounds
- projects.csv             -> bronze_gitcoin2_projects
- applications.csv         -> bronze_gitcoin2_applications
- donations.csv            -> bronze_gitcoin2_donations        (195MB - streamed)
- applications_payouts.csv -> bronze_gitcoin2_payouts
- attestations.csv         -> bronze_gitcoin2_attestations     (77MB - streamed)
- metadata_cache.csv       -> bronze_gitcoin2_metadata_cache   (195MB - streamed)
- price_cache.csv          -> bronze_gitcoin2_price_cache
"""

import csv
import io
import os
import sys
from pathlib import Path

# Some CSV fields (e.g. metadata_cache JSON blobs) exceed the default 128KB limit
csv.field_size_limit(sys.maxsize)

import polars as pl
import psycopg2
from dagster import AssetOut, Output, get_dagster_logger, multi_asset

from utils.db import get_pg_engine, upsert_platform_metadata
from utils.graphql_helpers import (
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
)

logger = get_dagster_logger()

# ======================
# CONFIGURATION
# ======================
GITCOIN2_RAW_DATA_DIR = os.getenv(
    "GITCOIN2_RAW_DATA_DIR",
    "/app/raw_data/Gitcoin/17_March_2026",
)

# Tables to load: (csv_filename, table_name, large_file)
# large_file=True means stream via COPY batches instead of loading all into memory
CSV_TABLE_MAP = [
    ("rounds.csv",               "bronze_gitcoin2_rounds",              False),
    ("projects.csv",             "bronze_gitcoin2_projects",             True),
    ("applications.csv",         "bronze_gitcoin2_applications",         True),
    ("donations.csv",            "bronze_gitcoin2_donations",            True),
    ("applications_payouts.csv", "bronze_gitcoin2_payouts",              False),
    ("attestations.csv",         "bronze_gitcoin2_attestations",         True),
    ("attestation_txns.csv",     "bronze_gitcoin2_attestation_txns",     False),
    ("metadata_cache.csv",       "bronze_gitcoin2_metadata_cache",       True),
    ("price_cache.csv",          "bronze_gitcoin2_price_cache",          False),
    ("legacy_projects.csv",      "bronze_gitcoin2_legacy_projects",      False),
    ("project_roles.csv",        "bronze_gitcoin2_project_roles",        False),
    ("round_roles.csv",          "bronze_gitcoin2_round_roles",          False),
    ("pending_round_roles.csv",  "bronze_gitcoin2_pending_round_roles",  False),
    ("strategies_registry.csv",  "bronze_gitcoin2_strategies_registry",  False),
    ("strategy_timings.csv",     "bronze_gitcoin2_strategy_timings",     False),
    ("events_registry.csv",      "bronze_gitcoin2_events_registry",      False),
]

COPY_BATCH_ROWS = 100_000  # rows per COPY batch for large files

# When GITCOIN2_OBSERVE_ONLY=true, skip CSV loading and instead read row counts
# from existing bronze tables — lets Dagster "see" tables that were loaded outside
# of a Dagster run (e.g. after a deployment killed an in-flight bronze job).
GITCOIN2_OBSERVE_ONLY = os.getenv("GITCOIN2_OBSERVE_ONLY", "false").lower() == "true"


# ======================
# HELPERS
# ======================

def _get_conn():
    return psycopg2.connect(
        host=POSTGRES_HOST,
        port=int(POSTGRES_PORT),
        dbname=POSTGRES_DB,
        user=POSTGRES_USER,
        password=POSTGRES_PASSWORD,
    )


def _sanitize_value(v: str) -> str:
    """Escape special characters for Postgres COPY text format."""
    if v is None:
        return "\\N"
    # Escape backslash first, then special COPY chars
    return v.replace("\\", "\\\\").replace("\n", "\\n").replace("\r", "\\r").replace("\t", "\\t")


def _create_table(conn, table_name: str, columns: list[str]):
    """Drop and recreate table with all TEXT columns."""
    col_defs = ", ".join(f'"{c}" TEXT' for c in columns)
    with conn.cursor() as cur:
        cur.execute(f'DROP TABLE IF EXISTS "{table_name}" CASCADE')
        cur.execute(f'CREATE TABLE "{table_name}" ({col_defs})')
    conn.commit()


def _copy_batch(conn, table_name: str, columns: list[str], rows: list[list[str]]):
    """Write a batch of rows to Postgres using COPY FROM STDIN."""
    buf = io.StringIO()
    for row in rows:
        buf.write("\t".join(_sanitize_value(v) for v in row) + "\n")
    buf.seek(0)
    col_list = ", ".join(f'"{c}"' for c in columns)
    with conn.cursor() as cur:
        cur.copy_expert(f'COPY "{table_name}" ({col_list}) FROM STDIN', buf)
    conn.commit()


def _load_csv_copy(csv_path: Path, table_name: str) -> int:
    """
    Stream CSV file into Postgres via COPY FROM STDIN in batches.
    Handles any file size without loading it all into memory.
    """
    conn = _get_conn()
    total = 0
    created = False

    with open(csv_path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        columns = next(reader)  # header row

        # Sanitize column names
        columns = [c.strip().replace(" ", "_").replace(".", "_") for c in columns]

        batch: list[list[str]] = []

        for row in reader:
            # Pad short rows, truncate long rows
            if len(row) < len(columns):
                row += [""] * (len(columns) - len(row))
            elif len(row) > len(columns):
                row = row[: len(columns)]

            batch.append(row)

            if len(batch) >= COPY_BATCH_ROWS:
                if not created:
                    _create_table(conn, table_name, columns)
                    created = True
                _copy_batch(conn, table_name, columns, batch)
                total += len(batch)
                logger.info(f"{table_name}: {total} rows written...")
                batch = []

        # Write remaining rows
        if batch:
            if not created:
                _create_table(conn, table_name, columns)
            _copy_batch(conn, table_name, columns, batch)
            total += len(batch)

    conn.close()
    logger.info(f"{table_name}: done — {total} total rows")
    return total


def _load_csv_small(csv_path: Path, table_name: str) -> int:
    """Load small CSV entirely into memory, then COPY in one shot."""
    conn = _get_conn()

    with open(csv_path, newline="", encoding="utf-8", errors="replace") as f:
        reader = csv.reader(f)
        columns = next(reader)
        columns = [c.strip().replace(" ", "_").replace(".", "_") for c in columns]
        rows = []
        for row in reader:
            if len(row) < len(columns):
                row += [""] * (len(columns) - len(row))
            elif len(row) > len(columns):
                row = row[: len(columns)]
            rows.append(row)

    _create_table(conn, table_name, columns)
    if rows:
        _copy_batch(conn, table_name, columns, rows)
    conn.close()

    logger.info(f"{table_name}: {len(rows)} rows loaded")
    return len(rows)


def _observe_existing_tables() -> dict:
    """
    Query the DB for row counts on existing bronze_gitcoin2_* tables.
    Used when GITCOIN2_OBSERVE_ONLY=true to register pre-existing tables
    in Dagster's event log without re-loading CSVs.
    Returns {table_name: row_count}. Tables that don't exist get count=0.
    """
    conn = _get_conn()
    counts = {}
    try:
        for _, table_name, _ in CSV_TABLE_MAP:
            with conn.cursor() as cur:
                cur.execute(
                    "SELECT EXISTS (SELECT FROM information_schema.tables "
                    "WHERE table_schema = 'public' AND table_name = %s)",
                    [table_name],
                )
                exists = cur.fetchone()[0]
                if exists:
                    cur.execute(f'SELECT COUNT(*) FROM "{table_name}"')
                    counts[table_name] = cur.fetchone()[0]
                    logger.info(f"[observe] {table_name}: {counts[table_name]} rows")
                else:
                    counts[table_name] = 0
                    logger.warning(f"[observe] {table_name}: does not exist")
    finally:
        conn.close()
    return counts


# ======================
# MAIN DAGSTER ASSET
# ======================
@multi_asset(
    outs={
        "bronze__gitcoin2_rounds": AssetOut(
            metadata={"description": "Gitcoin 2.0 grant rounds from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_projects": AssetOut(
            metadata={"description": "Gitcoin 2.0 registered projects from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_applications": AssetOut(
            metadata={"description": "Gitcoin 2.0 grant applications from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_donations": AssetOut(
            metadata={"description": "Gitcoin 2.0 donation transactions from CSV snapshot (195MB)"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_payouts": AssetOut(
            metadata={"description": "Gitcoin 2.0 application payouts from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_attestations": AssetOut(
            metadata={"description": "Gitcoin 2.0 on-chain attestations from CSV snapshot (77MB)"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_attestation_txns": AssetOut(
            metadata={"description": "Gitcoin 2.0 attestation transactions from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_metadata_cache": AssetOut(
            metadata={"description": "Gitcoin 2.0 IPFS metadata cache from CSV snapshot (195MB)"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_price_cache": AssetOut(
            metadata={"description": "Gitcoin 2.0 token price history from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_legacy_projects": AssetOut(
            metadata={"description": "Gitcoin 2.0 legacy projects from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_project_roles": AssetOut(
            metadata={"description": "Gitcoin 2.0 project roles from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_round_roles": AssetOut(
            metadata={"description": "Gitcoin 2.0 round roles from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_pending_round_roles": AssetOut(
            metadata={"description": "Gitcoin 2.0 pending round roles from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_strategies_registry": AssetOut(
            metadata={"description": "Gitcoin 2.0 strategies registry from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_strategy_timings": AssetOut(
            metadata={"description": "Gitcoin 2.0 strategy timings from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_events_registry": AssetOut(
            metadata={"description": "Gitcoin 2.0 events registry from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
    },
    compute_kind="csv",
    group_name="bronze_gitcoin2",
)
def load_gitcoin2_csv_data():
    """
    Load Gitcoin 2.0 historical CSV snapshot into Postgres bronze tables.

    Uses psycopg2 COPY FROM STDIN for bulk ingestion — ~100x faster than
    individual INSERT statements. Large files (>30MB) are streamed in
    100k-row batches to keep memory bounded.

    Observe mode (GITCOIN2_OBSERVE_ONLY=true):
    Skip CSV loading — query existing table row counts and register them in
    Dagster's event log. Use this when bronze tables already exist in the DB
    but Dagster shows them as unmateriailzed (e.g. after a killed run).
    """
    if GITCOIN2_OBSERVE_ONLY:
        logger.info("GITCOIN2_OBSERVE_ONLY=true — reading row counts from existing tables")
        counts = _observe_existing_tables()
        missing = [t for t, n in counts.items() if n == 0]
        if missing:
            raise Exception(
                f"Observe mode: the following tables are missing or empty in the DB: {missing}\n"
                "Run the full bronze_gitcoin2_job (with GITCOIN2_OBSERVE_ONLY unset) to load them."
            )
        summary = ", ".join(f"{k.replace('bronze_gitcoin2_', '')}: {v}" for k, v in counts.items())
        logger.info(f"Observe complete — {summary}")
        for _, table_name, _ in CSV_TABLE_MAP:
            asset_key = table_name.replace("bronze_gitcoin2_", "bronze__gitcoin2_")
            yield Output(counts[table_name], asset_key, metadata={"row_count": counts[table_name]})
        return

    data_dir = Path(GITCOIN2_RAW_DATA_DIR)
    logger.info(f"Loading Gitcoin2 CSV data from: {data_dir}")

    if not data_dir.exists():
        raise FileNotFoundError(
            f"GITCOIN2_RAW_DATA_DIR not found: {data_dir}\n"
            "Set the GITCOIN2_RAW_DATA_DIR env variable to the correct path."
        )

    counts = {}
    for csv_file, table_name, large_file in CSV_TABLE_MAP:
        csv_path = data_dir / csv_file
        if not csv_path.exists():
            logger.warning(f"File not found, skipping: {csv_path}")
            counts[table_name] = 0
            continue

        size_mb = csv_path.stat().st_size / 1_048_576
        logger.info(f"Loading {csv_file} ({size_mb:.1f}MB) -> {table_name}")

        if large_file:
            counts[table_name] = _load_csv_copy(csv_path, table_name)
        else:
            counts[table_name] = _load_csv_small(csv_path, table_name)

    summary = ", ".join(f"{k.replace('bronze_gitcoin2_', '')}: {v}" for k, v in counts.items())
    logger.info(f"Gitcoin2 CSV load complete — {summary}")

    upsert_platform_metadata(get_pg_engine(), "gitcoin2", data_source="Gitcoin CSV snapshot")

    # Yield one Output per asset — row count as the value
    for _, table_name, _ in CSV_TABLE_MAP:
        asset_key = table_name.replace("bronze_gitcoin2_", "bronze__gitcoin2_")
        yield Output(
            counts.get(table_name, 0),
            asset_key,
            metadata={"row_count": counts.get(table_name, 0)},
        )
