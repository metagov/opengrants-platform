from dagster import Output, asset
from utils.translate_to_silver import build_silver
from utils.db import drop_dependent_views

@asset(
    name="silver__giveth_projects",
    description="DAOIP-5 compliant Project schema for Giveth",
    required_resource_keys={"database_engine"},
)
def silver_giveth_projects(context):
    engine = context.resources.database_engine

    df_silver = build_silver(
        engine=engine,
        schema_path="/app/configs/schema_maps/active/daoip5_giveth.yaml",
        section="projects",
    )

    drop_dependent_views(engine, "silver_giveth_projects", context)

    df_silver.write_database(
        table_name="silver_giveth_projects",
        connection=engine,
        if_table_exists="replace",
    )

    context.log.info(f"✅ Saved {df_silver.height} rows to silver_giveth_projects")
    return Output(df_silver)
