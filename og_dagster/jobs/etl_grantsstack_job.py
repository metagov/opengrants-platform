from assets.bronze.grantsstack import fetch_grantsstack_data
from dagster import AssetSelection, Definitions, define_asset_job

# Define ETL job for GrantStack bronze layer
grantsstack_etl_job = define_asset_job(
    name="bronze_grantsstack_job",
    selection=AssetSelection.assets(fetch_grantsstack_data),
    description="Ingest GrantStack (Gitcoin Grants Stack) API data into the Bronze layer.",
)

defs = Definitions(
    assets=[fetch_grantsstack_data],
    jobs=[grantsstack_etl_job],
)
