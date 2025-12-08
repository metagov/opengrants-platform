# og_dagster/jobs/etl_scf_job.py
from assets.bronze.scf import bronze_scf_csv_ingest
from dagster import AssetSelection, Definitions, define_asset_job

# This job will run all assets under bronze_scf*
etl_scf_job = define_asset_job(
    name="bronze_scf_job",
    selection=AssetSelection.keys("bronze_scf_csv_ingest"),
    description="ETL job to ingest SCF CSV data into the Bronze layer.",
)
defs = Definitions(
    assets=[bronze_scf_csv_ingest],
    jobs=[etl_scf_job],
)
