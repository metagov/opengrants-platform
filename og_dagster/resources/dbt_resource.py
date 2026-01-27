import os

from dagster_dbt import DbtCliResource

dbt_resource = DbtCliResource(
    project_dir="/app/dbt_project",
    profiles_dir="/app/dbt_project",
    target=os.getenv("DBT_TARGET", "dev_postgres"),
)
