import polars as pl
from dagster import Output, asset
from utils.db import get_pg_engine
from utils.helpers import build_silver


@asset(
    name="silver__giveth_grant_pools",
    description="DAOIP-5 compliant GrantPool schema for Giveth (QF rounds).",
)
def silver_giveth_grant_pools(context):
    engine = get_pg_engine()

    bronze = pl.read_database(
        "SELECT * FROM bronze_giveth_qf_rounds",
        connection=engine,
        infer_schema_length=10000
    )
    context.log.info(f"Loaded {len(bronze)} bronze Giveth rounds.")

    df_silver = build_silver(
        bronze,
        "/app/configs/schema_maps/active/daoip5_giveth.yaml",
        section="grant_pools",
    )

    # ✅ Write Silver back to Postgres
    df_silver.write_database(
        table_name="silver_giveth_grant_pools",
        connection=engine,
        if_table_exists="replace"
    )
    context.log.info(f"🗄 Saved {len(df_silver)} rows to table 'silver_giveth_grant_pools'.")

    context.log.info(f"✅ {len(df_silver)} Giveth grant pools validated and transformed.")
    return Output(df_silver)
