# og_dagster/assets/bronze/scf.py
"""Bronze layer: Ingest SCF data from Airtable API into Postgres."""

import os

import polars as pl
from dagster import asset, get_dagster_logger
from utils.airtable_helpers import fetch_airtable_table
from utils.db import get_pg_engine
from utils.graphql_helpers import sanitize_for_sql

logger = get_dagster_logger()

# Airtable SCF Base and Table IDs
SCF_BASE_ID = "app8tLjMIDrjeloWN"
SCF_TABLES = {
    "bronze_scf_projects": "tblQFNVNhCxfzUgbF",       # Awarded Projects [Build only]
    "bronze_scf_submissions": "tbl57OROvn0qQTuiP",     # Awarded Submissions [Build only]
    "bronze_scf_rounds": "tbl9nsqJMzoACJVE0",          # Build Award Rounds
}


@asset(
    name="bronze_scf_airtable_ingest",
    description="Ingest SCF data from Airtable API into Postgres bronze layer.",
    group_name="bronze",
)
def bronze_scf_airtable_ingest(context):
    api_key = os.getenv("AIRTABLE_API_KEY")
    if not api_key:
        raise RuntimeError("AIRTABLE_API_KEY environment variable is not set.")

    engine = get_pg_engine()
    context.log.info(f"Fetching SCF data from Airtable base {SCF_BASE_ID}")

    for table_name, table_id in SCF_TABLES.items():
        context.log.info(f"Fetching {table_name} (table: {table_id})")

        try:
            records = fetch_airtable_table(
                base_id=SCF_BASE_ID,
                table_id=table_id,
                api_key=api_key,
            )

            if not records:
                context.log.warning(f"No records returned for {table_name}")
                continue

            df = pl.DataFrame(records)
            # Drop internal Airtable record ID before writing to bronze
            if "_airtable_id" in df.columns:
                df = df.drop("_airtable_id")

            df = sanitize_for_sql(df)
            pdf = df.to_pandas()

            with engine.begin() as conn:
                pdf.to_sql(table_name, conn, if_exists="replace", index=False)

            context.log.info(f"Loaded {len(df)} records into {table_name}")

        except Exception as e:
            context.log.error(f"Failed fetching {table_name}: {e}")
            raise

    context.log.info("Bronze SCF Airtable ingest complete.")
