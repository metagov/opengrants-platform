# og_dagster/assets/bronze/gitcoin2.py
"""
Bronze layer loader for Gitcoin 2.0 CSV snapshot.

Reads CSV files from GITCOIN2_RAW_DATA_DIR and loads them into Postgres
as bronze_gitcoin2_* tables.

CSV Files:
- rounds.csv           -> bronze_gitcoin2_rounds
- projects.csv         -> bronze_gitcoin2_projects
- applications.csv     -> bronze_gitcoin2_applications
- donations.csv        -> bronze_gitcoin2_donations        (large - streamed)
- applications_payouts.csv -> bronze_gitcoin2_payouts
- attestations.csv     -> bronze_gitcoin2_attestations
- metadata_cache.csv   -> bronze_gitcoin2_metadata_cache
- price_cache.csv      -> bronze_gitcoin2_price_cache
"""

import os
from pathlib import Path
from typing import List

import polars as pl
from dagster import AssetOut, Output, get_dagster_logger, multi_asset
from sqlalchemy import create_engine

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

# Tables to load: (csv_filename, table_name, stream_large)
# stream_large=True means write in chunks (for 100k+ row files)
CSV_TABLE_MAP = [
    ("rounds.csv",               "bronze_gitcoin2_rounds",          False),
    ("projects.csv",             "bronze_gitcoin2_projects",         False),
    ("applications.csv",         "bronze_gitcoin2_applications",     False),
    ("donations.csv",            "bronze_gitcoin2_donations",        True),
    ("applications_payouts.csv", "bronze_gitcoin2_payouts",          False),
    ("attestations.csv",         "bronze_gitcoin2_attestations",     False),
    ("metadata_cache.csv",       "bronze_gitcoin2_metadata_cache",   False),
    ("price_cache.csv",          "bronze_gitcoin2_price_cache",      False),
]

STREAM_BATCH_SIZE = 50_000

DB_URL = (
    f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)
engine = create_engine(DB_URL)


# ======================
# HELPERS
# ======================

def _sanitize_df(df: pl.DataFrame) -> pl.DataFrame:
    """Cast all columns to Utf8 (string) so Postgres accepts any value."""
    return df.with_columns([pl.col(c).cast(pl.Utf8) for c in df.columns])


def _load_csv(path: Path) -> pl.DataFrame:
    """Read CSV with Polars, all columns as strings to avoid type conflicts."""
    return pl.read_csv(
        path,
        infer_schema_length=0,   # treat every column as string
        truncate_ragged_lines=True,
        ignore_errors=True,
    )


def _write_df(df: pl.DataFrame, table_name: str, replace: bool) -> int:
    mode = "replace" if replace else "append"
    df.write_database(
        table_name=table_name,
        connection=engine,
        if_table_exists=mode,
    )
    logger.info(f"Wrote {len(df)} rows to {table_name} ({mode})")
    return len(df)


def _load_and_write_small(csv_path: Path, table_name: str) -> int:
    """Load entire CSV into memory then write once."""
    df = _sanitize_df(_load_csv(csv_path))
    return _write_df(df, table_name, replace=True)


def _load_and_write_large(csv_path: Path, table_name: str) -> int:
    """Stream CSV in batches to keep memory bounded."""
    total = 0
    first = True

    for batch_df in pl.read_csv_batched(
        csv_path,
        infer_schema_length=0,
        truncate_ragged_lines=True,
        ignore_errors=True,
        batch_size=STREAM_BATCH_SIZE,
    ).next_batches(10_000):  # iterate up to 10k batches
        if batch_df is None or len(batch_df) == 0:
            break
        df = _sanitize_df(batch_df)
        total += _write_df(df, table_name, replace=first)
        first = False

    logger.info(f"Total streamed to {table_name}: {total} rows")
    return total


def _read_table(table_name: str) -> pl.DataFrame:
    return pl.read_database(
        query=f"SELECT * FROM {table_name} LIMIT 1",
        connection=engine,
    )


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
            metadata={"description": "Gitcoin 2.0 donation transactions from CSV snapshot (497k rows)"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_payouts": AssetOut(
            metadata={"description": "Gitcoin 2.0 application payouts from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_attestations": AssetOut(
            metadata={"description": "Gitcoin 2.0 on-chain attestations from CSV snapshot"},
            tags={"layer": "bronze", "source": "gitcoin2", "domain": "grants"},
        ),
        "bronze__gitcoin2_metadata_cache": AssetOut(
            metadata={"description": "Gitcoin 2.0 IPFS metadata cache from CSV snapshot"},
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

    Reads from GITCOIN2_RAW_DATA_DIR (default: /app/raw_data/Gitcoin/17_March_2026).
    Large files (donations) are streamed in 50k-row batches to bound memory usage.
    """
    data_dir = Path(GITCOIN2_RAW_DATA_DIR)
    logger.info(f"Loading Gitcoin2 CSV data from: {data_dir}")

    if not data_dir.exists():
        raise FileNotFoundError(
            f"GITCOIN2_RAW_DATA_DIR not found: {data_dir}\n"
            "Set the GITCOIN2_RAW_DATA_DIR env variable to the correct path."
        )

    counts = {}
    for csv_file, table_name, stream_large in CSV_TABLE_MAP:
        csv_path = data_dir / csv_file
        if not csv_path.exists():
            logger.warning(f"File not found, skipping: {csv_path}")
            counts[table_name] = 0
            continue

        logger.info(f"Loading {csv_file} -> {table_name} (stream={stream_large})")
        if stream_large:
            counts[table_name] = _load_and_write_large(csv_path, table_name)
        else:
            counts[table_name] = _load_and_write_small(csv_path, table_name)

    summary = ", ".join(f"{k.replace('bronze_gitcoin2_', '')}: {v}" for k, v in counts.items())
    logger.info(f"Gitcoin2 CSV load complete — {summary}")

    # Return minimal DataFrames as asset outputs (full data is in Postgres)
    yield Output(
        pl.read_database("SELECT * FROM bronze_gitcoin2_rounds LIMIT 5", engine),
        "bronze__gitcoin2_rounds",
        metadata={"row_count": counts.get("bronze_gitcoin2_rounds", 0)},
    )
    yield Output(
        pl.read_database("SELECT * FROM bronze_gitcoin2_projects LIMIT 5", engine),
        "bronze__gitcoin2_projects",
        metadata={"row_count": counts.get("bronze_gitcoin2_projects", 0)},
    )
    yield Output(
        pl.read_database("SELECT * FROM bronze_gitcoin2_applications LIMIT 5", engine),
        "bronze__gitcoin2_applications",
        metadata={"row_count": counts.get("bronze_gitcoin2_applications", 0)},
    )
    yield Output(
        pl.read_database("SELECT * FROM bronze_gitcoin2_donations LIMIT 5", engine),
        "bronze__gitcoin2_donations",
        metadata={"row_count": counts.get("bronze_gitcoin2_donations", 0)},
    )
    yield Output(
        pl.read_database("SELECT * FROM bronze_gitcoin2_payouts LIMIT 5", engine),
        "bronze__gitcoin2_payouts",
        metadata={"row_count": counts.get("bronze_gitcoin2_payouts", 0)},
    )
    yield Output(
        pl.read_database("SELECT * FROM bronze_gitcoin2_attestations LIMIT 5", engine),
        "bronze__gitcoin2_attestations",
        metadata={"row_count": counts.get("bronze_gitcoin2_attestations", 0)},
    )
    yield Output(
        pl.read_database("SELECT * FROM bronze_gitcoin2_metadata_cache LIMIT 5", engine),
        "bronze__gitcoin2_metadata_cache",
        metadata={"row_count": counts.get("bronze_gitcoin2_metadata_cache", 0)},
    )
    yield Output(
        pl.read_database("SELECT * FROM bronze_gitcoin2_price_cache LIMIT 5", engine),
        "bronze__gitcoin2_price_cache",
        metadata={"row_count": counts.get("bronze_gitcoin2_price_cache", 0)},
    )
