from dagster import asset
from utils.translate_to_silver import build_silver

SCHEMA_PATH = "/app/configs/schema_maps/active/daoip5_scf.yaml"


@asset(required_resource_keys={"database_engine"})
def silver_scf_projects(context):
    return build_silver(
        engine=context.resources.database_engine,
        schema_path=SCHEMA_PATH,
        section="projects",
    )


@asset(required_resource_keys={"database_engine"})
def silver_scf_grant_applications(context):
    return build_silver(
        engine=context.resources.database_engine,
        schema_path=SCHEMA_PATH,
        section="grant_applications",
    )


@asset(required_resource_keys={"database_engine"})
def silver_scf_grant_pools(context):
    return build_silver(
        engine=context.resources.database_engine,
        schema_path=SCHEMA_PATH,
        section="grant_pools",
    )
