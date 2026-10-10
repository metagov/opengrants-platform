# og_dagster/assets/bronze/scf.py
"""Bronze layer: Ingest SCF data from Airtable API into Postgres."""

import os

import polars as pl
from dagster import asset
from configs.scf_airtable import SCF_BASE_ID, SCF_TABLES
from utils.airtable_helpers import fetch_airtable_table
from utils.db import drop_table_cascade, upsert_platform_metadata
from utils.scf_archive import archive_bronze_snapshot
from utils.graphql_helpers import sanitize_for_sql


@asset(
    name="bronze_scf_airtable_ingest",
    description="Ingest SCF data from Airtable API into Postgres bronze layer.",
    group_name="bronze",
    required_resource_keys={"database_engine"},
)
def bronze_scf_airtable_ingest(context):
    api_key = os.getenv("AIRTABLE_API_KEY")
    if not api_key:
        raise RuntimeError("AIRTABLE_API_KEY environment variable is not set.")

    engine = context.resources.database_engine
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

            # Archive before overwriting: bronze is dropped and replaced below, so this is
            # the only copy of the previous state. If archiving fails, the exception aborts
            # the run and bronze is left untouched.
            archived = archive_bronze_snapshot(engine, table_name, records, run_id=context.run_id)
            context.log.info(
                f"Archived {table_name} snapshot ({len(records)} records)" if archived
                else f"{table_name} unchanged since last snapshot; nothing archived"
            )

            df = pl.DataFrame(records)
            # Drop internal Airtable record ID before writing to bronze.
            # `_airtable_created_time` is kept: silver maps it to DAOIP-5 createdAt.
            if "_airtable_id" in df.columns:
                df = df.drop("_airtable_id")

            df = sanitize_for_sql(df)
            drop_table_cascade(engine, table_name, context)
            df.write_database(
                table_name=table_name,
                connection=engine,
                if_table_exists="replace",
            )

            context.log.info(f"Loaded {len(df)} records into {table_name}")

        except Exception as e:
            context.log.error(f"Failed fetching {table_name}: {e}")
            raise

    upsert_platform_metadata(engine, "scf", data_source="Airtable API")
    context.log.info("Bronze SCF Airtable ingest complete.")
