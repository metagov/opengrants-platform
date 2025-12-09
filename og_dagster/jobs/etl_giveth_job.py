from assets.bronze.giveth import fetch_giveth_data
from dagster import AssetSelection, Definitions, define_asset_job

# Define ETL job for Giveth bronze layer
giveth_etl_job = define_asset_job(
    name="bronze_giveth_job",
    selection=AssetSelection.assets(
        fetch_giveth_data
    ),  # auto-detects both bronze assets
    description="Ingest Giveth API data into the Bronze layer.",
)

defs = Definitions(
    assets=[fetch_giveth_data],
    jobs=[giveth_etl_job],
)
