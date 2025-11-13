from assets.bronze.privote import fetch_privote_data
from dagster import AssetSelection, Definitions, define_asset_job

# Define ETL job for Privote bronze layer
privote_etl_job = define_asset_job(
    name="bronze_privote_job",
    selection=AssetSelection.assets(
        fetch_privote_data
    ),  # auto-detects both bronze assets
)

defs = Definitions(
    assets=[fetch_privote_data],
    jobs=[privote_etl_job],
)
