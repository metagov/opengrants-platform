# --- Privote Silver Transformation Asset --- / og_dagster/assets/silver/privote/privote.py
import os
import polars as pl
from dagster import asset, get_dagster_logger
from utils.db import get_pg_engine
from utils.graphql_helpers import sanitize_for_sql
from utils.translate_to_silver import build_silver

logger = get_dagster_logger()

@asset(
    name="silver_privote_transform",
    description="Transforms Privote Bronze data into DAOIP-5 compliant Silver tables.",
    group_name="silver",
    deps=["privote_contract_recipients", "privote_contract_recipients__metadata__contribution_links", "privote_contract_recipients__metadata__funding_sources", "privote_contract_recipients__metadata__impact_category", "privote_grant_pool"],
)

def silver_privote_transform(context):
    schema_path = os.getenv(
        "SCF_SCHEMA_PATH",
        "/app/configs/schema_maps/active/daoip5_privote.yaml"
    )
    engine = get_pg_engine()
    context.log.info(f"📜 Loading Privote schema: {schema_path}")

    # Mapping: section → bronze table
    sections = {
        "projects": "privote_contract_recipients",
        "grant_applications": "privote_contract_recipients__metadata__contribution_links",
        "grant_pools": "privote_grant_pool",
    }

    for section, table in sections.items():
        context.log.info(f"⚙️ Transforming {section} from {table}...")
        with engine.connect() as conn:
            df = pl.read_database(f"SELECT * FROM {table}", conn)

        df_silver = build_silver(df, schema_path, section)
        df_silver = sanitize_for_sql(df_silver)

        target_table = f"silver_privote_{section}"
        with engine.begin() as conn:
            df_silver.to_pandas().to_sql(target_table, conn, if_exists="replace", index=False)

        context.log.info(f"✅ {table} → {target_table} ({df_silver.height} rows, {df_silver.width} cols)")

    context.log.info("🎯 Privote Silver transformation complete.")
