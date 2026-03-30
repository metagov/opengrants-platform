from dagster import Output, asset
from utils.data_quality import write_data_quality_report
from utils.db import drop_table_cascade
from utils.translate_to_silver import build_silver


@asset(
    name="silver__giveth_grant_pools",
    group_name="silver",
    description="DAOIP-5 compliant GrantPool schema for Giveth",
    required_resource_keys={"database_engine"},
)
def silver_giveth_grant_pools(context):
    engine = context.resources.database_engine

    df_silver, null_issues = build_silver(
        engine=engine,
        schema_path="/app/configs/schema_maps/active/daoip5_giveth.yaml",
        section="grant_pools",
    )

    drop_table_cascade(engine, "silver_giveth_grant_pools", context)

    df_silver.write_database(
        table_name="silver_giveth_grant_pools",
        connection=engine,
        if_table_exists="replace",
    )
    write_data_quality_report("giveth", "silver_giveth_grant_pools", df_silver.height, null_issues, [], context.run_id)

    context.log.info(f"✅ Saved {df_silver.height} rows to silver_giveth_grant_pools")
    return Output(df_silver)
