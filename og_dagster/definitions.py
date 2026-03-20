"""
Single Dagster Definitions entry point.
Consolidates all assets, jobs, and resources into one code location
to avoid spawning multiple gRPC code server processes.
"""

import os
from pathlib import Path

from dagster import AssetSelection, Definitions, define_asset_job
from dagster_dbt import DbtCliResource, dbt_assets, DagsterDbtTranslator

# --- Bronze Assets ---
from assets.bronze.giveth import fetch_giveth_data
from assets.bronze.privote import fetch_privote_data
from assets.bronze.scf import bronze_scf_airtable_ingest
from assets.bronze.grantsstack import fetch_grantsstack_data

# --- Silver Assets ---
from assets.silver.giveth.projects import silver_giveth_projects
from assets.silver.giveth.rounds import silver_giveth_grant_pools
from assets.silver.privote.privote import silver_privote_transform
from assets.silver.scf.scf import (
    silver_scf_grant_applications,
    silver_scf_grant_pools,
    silver_scf_projects,
)
from assets.silver.grantsstack.grantsstack import (
    silver_grantsstack_grant_pools,
    silver_grantsstack_projects,
    silver_grantsstack_grant_applications,
    silver_grantsstack_donations,
    silver_grantsstack_payouts,
)

# --- Sensors ---
from sensors.scf_sensor import airtable_scf_sensor

# --- Resources ---
from resources.database import database_engine_resource

# --- Gold (dbt) Assets ---
from dagster import AssetExecutionContext

DBT_PROJECT_DIR = Path("/app/dbt_project")
MANIFEST_PATH = DBT_PROJECT_DIR / "target" / "manifest.json"

dbt_resource = DbtCliResource(
    project_dir=DBT_PROJECT_DIR,
    profiles_dir=DBT_PROJECT_DIR,
    target=os.getenv("DBT_TARGET", "dev_postgres"),
)


@dbt_assets(manifest=MANIFEST_PATH, select="tag:gold")
def gold_dbt_assets(context: AssetExecutionContext, dbt: DbtCliResource):
    """Run dbt models tagged with 'gold' for analytics layer."""
    yield from dbt.cli(["build"], context=context).stream()


# =============================================================================
# Bronze Jobs
# =============================================================================

bronze_giveth_job = define_asset_job(
    name="bronze_giveth_job",
    selection=AssetSelection.assets(fetch_giveth_data),
    description="Ingest Giveth API data into the Bronze layer.",
)

bronze_privote_job = define_asset_job(
    name="bronze_privote_job",
    selection=AssetSelection.assets(fetch_privote_data),
    description="Ingest Privote Subgraph data into the Bronze layer.",
)

bronze_scf_job = define_asset_job(
    name="bronze_scf_job",
    selection=AssetSelection.keys("bronze_scf_airtable_ingest"),
    description="Ingest SCF Airtable data into the Bronze layer.",
)

bronze_grantsstack_job = define_asset_job(
    name="bronze_grantsstack_job",
    selection=AssetSelection.assets(fetch_grantsstack_data),
    description="Ingest GrantStack (Gitcoin Grants Stack) API data into the Bronze layer.",
)

# =============================================================================
# Silver Jobs
# =============================================================================

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

# =============================================================================
# Gold Jobs
# =============================================================================

gold_dbt_job = define_asset_job(
    name="gold_dbt_job",
    selection=AssetSelection.assets(gold_dbt_assets),
    description="Run dbt Gold layer models to create analytics tables.",
)

# =============================================================================
# Full SCF Pipeline Job (bronze -> silver, triggered by sensor)
# =============================================================================

etl_scf_full_job = define_asset_job(
    name="etl_scf_full_job",
    selection=AssetSelection.assets(
        bronze_scf_airtable_ingest,
        silver_scf_projects,
        silver_scf_grant_applications,
        silver_scf_grant_pools,
    ),
    description="Full SCF pipeline: Airtable -> Bronze -> Silver (auto-chained via deps).",
)

# =============================================================================
# Unified Definitions
# =============================================================================

defs = Definitions(
    assets=[
        # Bronze
        fetch_giveth_data,
        fetch_privote_data,
        bronze_scf_airtable_ingest,
        fetch_grantsstack_data,
        # Silver
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
        # Gold
        gold_dbt_assets,
    ],
    resources={
        "database_engine": database_engine_resource,
        "dbt": dbt_resource,
    },
    jobs=[
        # Bronze
        bronze_giveth_job,
        bronze_privote_job,
        bronze_scf_job,
        bronze_grantsstack_job,
        # Silver
        silver_giveth_etl_job,
        silver_scf_etl_job,
        silver_privote_etl_job,
        silver_grantsstack_etl_job,
        # Gold
        gold_dbt_job,
        # Full pipeline
        etl_scf_full_job,
    ],
    sensors=[
        airtable_scf_sensor,
    ],
)
