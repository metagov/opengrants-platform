from dagster_dbt import DbtCliResource
import os

dbt_resource = DbtCliResource(
    project_dir="/app/dbt",
    profiles_dir="/app/dbt",
    profile_name="opengrants",
    target=os.getenv("DBT_TARGET", "prod_postgres"),
)
