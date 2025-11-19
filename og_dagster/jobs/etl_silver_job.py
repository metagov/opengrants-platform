from dagster import AssetSelection, Definitions, define_asset_job
from resources.database import database_engine_resource

# --- Giveth Silver Assets ---
from assets.silver.giveth.projects import silver_giveth_projects
from assets.silver.giveth.rounds import silver_giveth_grant_pools

# --- SCF Silver Assets ---
from assets.silver.scf.scf import (
    silver_scf_projects,
    silver_scf_grant_applications,
    silver_scf_grant_pools,
)

# --- Privote Silver Assets ---
from assets.silver.privote.privote import silver_privote_transform


# -----------------------------
# Jobs
# -----------------------------

silver_giveth_etl_job = define_asset_job(
    name="silver_giveth_etl_job",
    selection=AssetSelection.assets(
        silver_giveth_projects,
        silver_giveth_grant_pools,
    ),
)

silver_scf_etl_job = define_asset_job(
    name="silver_scf_etl_job",
    selection=AssetSelection.assets(
        silver_scf_projects,
        silver_scf_grant_applications,
        silver_scf_grant_pools,
    ),
)

silver_privote_etl_job = define_asset_job(
    name="silver_privote_etl_job",
    selection=AssetSelection.assets(
        silver_privote_transform,
    ),
)


# -----------------------------
# Asset registry
# -----------------------------

defs = Definitions(
    assets=[
        silver_giveth_projects,
        silver_giveth_grant_pools,
        silver_privote_transform,
        silver_scf_projects,
        silver_scf_grant_applications,
        silver_scf_grant_pools,
    ],
    resources={
        "database_engine": database_engine_resource
    },
    jobs=[
        silver_giveth_etl_job,
        silver_scf_etl_job,
        silver_privote_etl_job,
    ],
)

