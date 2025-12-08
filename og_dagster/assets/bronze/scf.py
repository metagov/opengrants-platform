# og_dagster/assets/bronze/scf.py
import os

import polars as pl
from dagster import asset, get_dagster_logger
from utils.db import get_pg_engine
from utils.graphql_helpers import sanitize_for_sql

logger = get_dagster_logger()


@asset(
    name="bronze_scf_csv_ingest",
    description="Ingest raw SCF CSVs into Postgres bronze layer.",
    group_name="bronze",
)
def bronze_scf_csv_ingest(context):
    base_dir = os.getenv("RAW_DATA_PATH", "/app/raw_data/SCF/11_November_2025")
    engine = get_pg_engine()
    context.log.info(f"📂 Loading CSVs from: {base_dir}")

    csv_files = {
        "bronze_scf_projects": "Awarded Projects [Build only]-By Active _ Category 11_November_2025.csv",
        "bronze_scf_submissions": "Awarded Submissions [Build only]-By Round 11_November_2025.csv",
        "bronze_scf_rounds": "Build Award Rounds-By Year - 11_November_2025.csv",
    }

    for table_name, filename in csv_files.items():
        file_path = os.path.join(base_dir, filename)
        # ✅ Normalize and escape path for Polars
        safe_path = (
            file_path.replace("[", "\\[").replace("]", "\\]").replace(" ", "\\ ")
        )
        context.log.info(f"🔍 Attempting to read: {safe_path}")

        if not os.path.exists(file_path):
            context.log.warning(f"⚠️ File not found at {file_path}")
            continue

        try:
            # ✅ Use `glob=False` to disable wildcard expansion
            df = pl.read_csv(file_path, has_header=True, glob=False)
            df = sanitize_for_sql(df)
            pdf = df.to_pandas()

            with engine.begin() as conn:
                pdf.to_sql(table_name, conn, if_exists="replace", index=False)

            context.log.info(f"✅ Loaded {len(df)} records into {table_name}")

        except Exception as e:
            context.log.error(f"❌ Failed reading {file_path}: {e}")

    context.log.info("🎯 Bronze SCF ingest complete.")
