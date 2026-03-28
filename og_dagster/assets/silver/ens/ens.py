from dagster import AssetKey, asset
from utils.translate_to_silver import build_silver
from utils.graphql_helpers import sanitize_for_sql

SCHEMA_PATH = "/app/configs/schema_maps/active/daoip5_ens.yaml"


@asset(
    group_name="silver",
    required_resource_keys={"database_engine"},
    deps=[AssetKey("bronze__ens_proposals")],
)
def silver_ens_grant_pools(context):
    df_silver = build_silver(
        engine=context.resources.database_engine,
        schema_path=SCHEMA_PATH,
        section="grant_pools",
    )

    df_silver = sanitize_for_sql(df_silver)
    df_silver.write_database(
        table_name="silver_ens_grant_pools",
        connection=context.resources.database_engine,
        if_table_exists="replace",
    )

    return df_silver


@asset(
    group_name="silver",
    required_resource_keys={"database_engine"},
    deps=[AssetKey("bronze__ens_project_choices")],
)
def silver_ens_projects(context):
    df_silver = build_silver(
        engine=context.resources.database_engine,
        schema_path=SCHEMA_PATH,
        section="projects",
    )

    df_silver = sanitize_for_sql(df_silver)
    df_silver.write_database(
        table_name="silver_ens_projects",
        connection=context.resources.database_engine,
        if_table_exists="replace",
    )

    return df_silver
