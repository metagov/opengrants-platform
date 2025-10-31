from dagster import define_asset_job, AssetSelection, Definitions
from assets.bronze.giveth import fetch_giveth_data

# Define ETL job for Giveth bronze layer
giveth_etl_job = define_asset_job(
    name="giveth_etl_job",
    selection=AssetSelection.assets(fetch_giveth_data),  # auto-detects both bronze assets
)

defs = Definitions(
    assets=[fetch_giveth_data],
    jobs=[giveth_etl_job],
)
