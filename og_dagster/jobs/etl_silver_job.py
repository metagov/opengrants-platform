from assets.silver.giveth.projects import silver_giveth_projects
from assets.silver.giveth.rounds import silver_giveth_grant_pools
from dagster import AssetSelection, Definitions, define_asset_job

# Define the job that runs both silver transformations
silver_etl_job = define_asset_job(
    name="silver__giveth_etl_job",
    selection=AssetSelection.assets(silver_giveth_projects, silver_giveth_grant_pools),
)

defs = Definitions(
    assets=[silver_giveth_projects, silver_giveth_grant_pools],
    jobs=[silver_etl_job],
)
