import os

from dagster import asset
from utils.graphql_helpers import sanitize_for_sql
from utils.translate_to_silver import build_silver


@asset(
    name="silver_privote_transform",
    description="Transforms Privote Bronze data into DAOIP-5 compliant Silver tables.",
    group_name="silver",
    required_resource_keys={"database_engine"},
    deps=[
        "bronze_privote_recipients",
        "bronze_privote_registries",
        "bronze_privote_claims",
        "bronze_privote_deposits",
        "bronze_privote_metadata_urls",
        "bronze_privote_system",
        "ui_allocations",
    ],
)
def silver_privote_transform(context):
    schema_path = os.getenv(
        "PRIVOTE_SCHEMA_PATH", "/app/configs/schema_maps/active/daoip5_privote.yaml"
    )

    engine = context.resources.database_engine
    sections = ["projects", "grant_pools", "grant_applications"]

    for section in sections:
        context.log.info(f"⚙️ Transforming '{section}' ...")

        df_silver = build_silver(
            engine=engine,
            schema_path=schema_path,
            section=section,
        )

        df_silver = sanitize_for_sql(df_silver)

        target = f"silver_privote_{section}"
        df_silver.write_database(
            table_name=target,
            connection=engine,
            if_table_exists="replace",
        )

        context.log.info(f"✅ [{section}] → {target} ({df_silver.height} rows)")

    context.log.info("🎯 Privote Silver complete.")
