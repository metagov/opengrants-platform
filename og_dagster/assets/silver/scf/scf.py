import os
import polars as pl
from dagster import asset, get_dagster_logger
from utils.db import get_pg_engine
from utils.graphql_helpers import sanitize_for_sql
from utils.translate_to_silver import build_silver

logger = get_dagster_logger()

@asset(
    name="silver_scf_transform",
    description="Transforms SCF Bronze data into DAOIP-5 compliant Silver tables.",
    group_name="silver",
    deps=["bronze_scf_csv_ingest"],
)
def silver_scf_transform(context):
    schema_path = os.getenv(
        "SCF_SCHEMA_PATH",
        "/app/configs/schema_maps/active/daoip5_scf.yaml"
    )
    engine = get_pg_engine()
    context.log.info(f"📜 Loading SCF schema: {schema_path}")

    # Mapping: section → bronze table
    sections = {
        "projects": "bronze_scf_projects",
        "grant_applications": "bronze_scf_submissions",
        "grant_pools": "bronze_scf_rounds",
    }

    for section, table in sections.items():
        context.log.info(f"⚙️ Transforming {section} from {table}...")
        with engine.connect() as conn:
            df = pl.read_database(f"SELECT * FROM {table}", conn)

        df_silver = build_silver(df, schema_path, section)
        df_silver = sanitize_for_sql(df_silver)

        target_table = f"silver_scf_{section}"
        with engine.begin() as conn:
            df_silver.to_pandas().to_sql(target_table, conn, if_exists="replace", index=False)

        context.log.info(f"✅ {table} → {target_table} ({df_silver.height} rows, {df_silver.width} cols)")

    context.log.info("🎯 SCF Silver transformation complete.")
