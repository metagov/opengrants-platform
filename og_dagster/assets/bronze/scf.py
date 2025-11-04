# og_dagster/assets/bronze/scf.py
import os
import pandas as pd
import polars as pl
from dagster import asset, get_dagster_logger

from utils.db import get_pg_engine
from utils.helpers import sanitize_for_sql, align_columns

logger = get_dagster_logger()

@asset(
    name="bronze_scf_csv_ingest",
    description="Ingest raw SCF CSVs (Awarded Projects, Awarded Submissions, Rounds) into Postgres bronze layer.",
    group_name="bronze"
)
def bronze_scf_csv_ingest(context):
    """
    Loads raw SCF CSV files from raw_data/SCF into Postgres bronze tables.
    """

    base_dir = os.getenv("RAW_DATA_PATH", "raw_data/SCF/11_November_2025")
    engine = get_pg_engine()

    csv_files = {
        "bronze_scf_projects": "Awarded Projects [Build only]-By Active _ Category 11_November_2025.csv",
        "bronze_scf_submissions": "Awarded Submissions [Build only]-By Round 11_November_2025.csv",
        "bronze_scf_rounds": "Build Award Rounds-By Year - 11_November_2025.csv",
    }

    for table_name, filename in csv_files.items():
        file_path = os.path.join(base_dir, filename)
        if not os.path.exists(file_path):
            context.log.warning(f"⚠️ File not found: {file_path}")
            continue

        context.log.info(f"📥 Loading {file_path}")
        df = pl.read_csv(file_path)
        df = sanitize_for_sql(df)
        pdf = df.to_pandas()

        with engine.begin() as conn:
            pdf.to_sql(table_name, conn, if_exists="replace", index=False)
        context.log.info(f"✅ Loaded {len(df)} records into {table_name}")

    context.log.info("🎯 Bronze SCF ingest complete.")
