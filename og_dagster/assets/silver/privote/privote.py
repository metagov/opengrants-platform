import os
import polars as pl
from dagster import asset, get_dagster_logger
from utils.db import get_pg_engine
from utils.graphql_helpers import sanitize_for_sql
from utils.translate_to_silver import build_silver

logger = get_dagster_logger()

@asset(
    name="silver_privote_transform",
    description="Transforms Privote Bronze data into DAOIP-5 compliant Silver tables using unified schema mapping.",
    group_name="silver",
    deps=[
        "bronze_privote_recipients",
        "bronze_privote_registries", 
        "bronze_privote_claims",
        "bronze_privote_deposits",
        "bronze_privote_metadata_urls",  # ADDED - used for projects
        "bronze_privote_system",         # ADDED - used for grant pools
        "ui_allocations",                # ADDED - used for grant applications
    ],
)
def silver_privote_transform(context):
    """Unified Privote → DAOIP-5 Silver transformation job."""
    schema_path = os.getenv(
        "SCF_SCHEMA_PATH",
        "/app/configs/schema_maps/active/daoip5_privote.yaml"
    )

    engine = get_pg_engine()
    context.log.info(f"📜 Loading Privote schema from: {schema_path}")

    # Three canonical Silver sections
    sections = ["projects", "grant_pools", "grant_applications"]

    for section in sections:
        try:
            context.log.info(f"⚙️ Transforming section '{section}' ...")
            df_silver = build_silver(engine, schema_path, section)
            df_silver = sanitize_for_sql(df_silver)

            target_table = f"silver_privote_{section}"
            
            # Write to database
            with engine.begin() as conn:
                df_silver.write_database(
                    table_name=target_table,
                    connection=conn,
                    if_table_exists="replace"
                )

            context.log.info(
                f"✅ [{section}] → {target_table} ({df_silver.height} rows, {df_silver.width} cols)"
            )

        except Exception as e:
            context.log.error(f"❌ Failed transforming '{section}': {e}", exc_info=True)
            raise e

    context.log.info("🎯 Privote Silver normalization complete.")