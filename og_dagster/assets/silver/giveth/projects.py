import polars as pl
from dagster import Output, asset
from utils.db import get_pg_engine
from utils.translate_to_silver import build_silver
from utils.db import drop_dependent_views


@asset(
    name="silver__giveth_projects",
    description="DAOIP-5 compliant Project schema for Giveth",
)
def silver_giveth_projects(context):
    engine = get_pg_engine()

    bronze = pl.read_database(
        "SELECT * FROM bronze_giveth_projects",
        connection=engine,
        infer_schema_length=10000
    )
    context.log.info(f"Loaded {len(bronze)} bronze Giveth projects.")
    

    df_silver = build_silver(
        bronze,
        "/app/configs/schema_maps/active/daoip5_giveth.yaml",
        "projects",
    )

    drop_dependent_views(engine, "silver_giveth_projects", context)


    # ✅ Write Silver back to Postgres
    df_silver.write_database(
        table_name="silver_giveth_projects",
        connection=engine,
        if_table_exists="replace"
    )
    context.log.info(f"🗄 Saved {len(df_silver)} rows to table 'silver_giveth_projects'.")

    context.log.info(f"✅ {len(df_silver)} validated project rows transformed to Silver layer.")
    return Output(df_silver)
