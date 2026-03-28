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
    ("rounds.csv",               "bronze_gitcoin2_rounds",          False),
    ("projects.csv",             "bronze_gitcoin2_projects",         True),
    ("applications.csv",         "bronze_gitcoin2_applications",     True),
    ("donations.csv",            "bronze_gitcoin2_donations",        True),
    ("applications_payouts.csv", "bronze_gitcoin2_payouts",          False),
    ("attestations.csv",         "bronze_gitcoin2_attestations",     True),
    ("metadata_cache.csv",       "bronze_gitcoin2_metadata_cache",   True),
    ("price_cache.csv",          "bronze_gitcoin2_price_cache",      False),
]

COPY_BATCH_ROWS = 100_000  # rows per COPY batch for large files


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
        "bronze__gitcoin2_metadata_cache": AssetOut(
            metadata={"description": "Gitcoin 2.0 IPFS metadata cache from CSV snapshot (195MB)"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_price_cache": AssetOut(
            metadata={"description": "Gitcoin 2.0 token price history from CSV snapshot"},
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
    """
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

    # Yield minimal outputs (data is in Postgres)
    conn = _get_conn()
    for asset_key, table_name in [
        ("bronze__gitcoin2_rounds",        "bronze_gitcoin2_rounds"),
        ("bronze__gitcoin2_projects",      "bronze_gitcoin2_projects"),
        ("bronze__gitcoin2_applications",  "bronze_gitcoin2_applications"),
        ("bronze__gitcoin2_donations",     "bronze_gitcoin2_donations"),
        ("bronze__gitcoin2_payouts",       "bronze_gitcoin2_payouts"),
        ("bronze__gitcoin2_attestations",  "bronze_gitcoin2_attestations"),
        ("bronze__gitcoin2_metadata_cache","bronze_gitcoin2_metadata_cache"),
        ("bronze__gitcoin2_price_cache",   "bronze_gitcoin2_price_cache"),
    ]:
        yield Output(
            counts.get(table_name, 0),
            asset_key,
            metadata={"row_count": counts.get(table_name, 0)},
        )
    conn.close()
