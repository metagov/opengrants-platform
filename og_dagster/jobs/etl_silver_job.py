from dagster import AssetSelection, Definitions, define_asset_job

# --- Giveth Silver Assets ---
from assets.silver.giveth.projects import silver_giveth_projects
from assets.silver.giveth.rounds import silver_giveth_grant_pools

# --- SCF Silver Assets ---
from assets.silver.scf.scf import silver_scf_transform


# Define Silver Jobs

# Giveth ETL Job
silver_giveth_etl_job = define_asset_job(
    name="silver_giveth_etl_job",
    selection=AssetSelection.assets(silver_giveth_projects, silver_giveth_grant_pools),
)

# SCF ETL Job
silver_scf_etl_job = define_asset_job(
    name="silver_scf_etl_job",
    selection=AssetSelection.assets(silver_scf_transform),
)

# Register Definitions

defs = Definitions(
    assets=[
        silver_giveth_projects,
        silver_giveth_grant_pools,
        silver_scf_transform,
    ],
    jobs=[
        silver_giveth_etl_job,
        silver_scf_etl_job,
    ],
)

# Note:
# Append new Silver jobs here as needed (e.g., Celo, Gitcoin, Octant)
