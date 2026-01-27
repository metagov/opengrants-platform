# og_dagster/assets/gold/assets.py
import os
from pathlib import Path
from dagster import AssetExecutionContext, AssetSelection, Definitions, define_asset_job
from dagster_dbt import DbtCliResource, dbt_assets

DBT_PROJECT_DIR = Path("/app/dbt_project")
MANIFEST_PATH = DBT_PROJECT_DIR / "target" / "manifest.json"

# dbt resource for executing dbt commands
dbt_resource = DbtCliResource(
    project_dir=DBT_PROJECT_DIR,
    profiles_dir=DBT_PROJECT_DIR,
    target=os.getenv("DBT_TARGET", "dev_postgres"),
)


@dbt_assets(manifest=MANIFEST_PATH, select="tag:gold")
def gold_dbt_assets(context: AssetExecutionContext, dbt: DbtCliResource):
    """Run dbt models tagged with 'gold' for analytics layer."""
    yield from dbt.cli(["build"], context=context).stream()


# Define job for running gold layer dbt models
gold_dbt_job = define_asset_job(
    name="gold_dbt_job",
    selection=AssetSelection.assets(gold_dbt_assets),
    description="Run dbt Gold layer models to create analytics tables.",
)

# Dagster Definitions for this module
defs = Definitions(
    assets=[gold_dbt_assets],
    resources={"dbt": dbt_resource},
    jobs=[gold_dbt_job],
)
