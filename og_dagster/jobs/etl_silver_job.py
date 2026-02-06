# --- Giveth Silver Assets ---
from assets.silver.giveth.projects import silver_giveth_projects
from assets.silver.giveth.rounds import silver_giveth_grant_pools

# --- Privote Silver Assets ---
from assets.silver.privote.privote import silver_privote_transform

# --- SCF Silver Assets ---
from assets.silver.scf.scf import (
    silver_scf_grant_applications,
    silver_scf_grant_pools,
    silver_scf_projects,
)

# --- GrantStack Silver Assets ---
from assets.silver.grantsstack.grantsstack import (
    silver_grantsstack_grant_pools,
    silver_grantsstack_projects,
    silver_grantsstack_grant_applications,
    silver_grantsstack_donations,
    silver_grantsstack_payouts,
)

from dagster import AssetSelection, Definitions, define_asset_job
from resources.database import database_engine_resource

# -----------------------------
# Jobs
# -----------------------------

silver_giveth_etl_job = define_asset_job(
    name="silver_giveth_etl_job",
    selection=AssetSelection.assets(
        silver_giveth_projects,
        silver_giveth_grant_pools,
    ),
    description="Transform Giveth API Raw data into the Silver layer.",

)

silver_scf_etl_job = define_asset_job(
    name="silver_scf_etl_job",
    selection=AssetSelection.assets(
        silver_scf_projects,
        silver_scf_grant_applications,
        silver_scf_grant_pools,
    ),
    description="Transform SCF Raw data into the Silver layer.",
)

silver_privote_etl_job = define_asset_job(
    name="silver_privote_etl_job",
    selection=AssetSelection.assets(
        silver_privote_transform,
    ),
    description="Transform Privote Subgraph Raw data into the Silver layer.",
)

silver_grantsstack_etl_job = define_asset_job(
    name="silver_grantsstack_etl_job",
    selection=AssetSelection.assets(
        silver_grantsstack_grant_pools,
        silver_grantsstack_projects,
        silver_grantsstack_grant_applications,
        silver_grantsstack_donations,
        silver_grantsstack_payouts,
    ),
    description="Transform GrantStack Raw data into the Silver layer (DAOIP-5 compliant).",
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
        silver_grantsstack_grant_pools,
        silver_grantsstack_projects,
        silver_grantsstack_grant_applications,
        silver_grantsstack_donations,
        silver_grantsstack_payouts,
    ],
    resources={"database_engine": database_engine_resource},
    jobs=[
        silver_giveth_etl_job,
        silver_scf_etl_job,
        silver_privote_etl_job,
        silver_grantsstack_etl_job,
    ],
)
