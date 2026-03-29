"""
Single Dagster Definitions entry point.
Consolidates all assets, jobs, and resources into one code location
to avoid spawning multiple gRPC code server processes.
"""

import os
from pathlib import Path

from dagster import AssetSelection, Definitions, define_asset_job, multiprocess_executor
from dagster_dbt import DbtCliResource, dbt_assets, DagsterDbtTranslator

# --- Bronze Assets ---
from assets.bronze.ens import fetch_ens_data
from assets.bronze.giveth import fetch_giveth_data
from assets.bronze.privote import fetch_privote_data
from assets.bronze.scf import bronze_scf_airtable_ingest
from assets.bronze.gitcoin2 import load_gitcoin2_csv_data

# --- Silver Assets ---
from assets.silver.ens.ens import silver_ens_grant_pools, silver_ens_projects
from assets.silver.giveth.projects import silver_giveth_projects
from assets.silver.giveth.rounds import silver_giveth_grant_pools
from assets.silver.privote.privote import silver_privote_transform
from assets.silver.scf.scf import (
    silver_scf_grant_applications,
    silver_scf_grant_pools,
    silver_scf_projects,
)
from assets.silver.gitcoin2.gitcoin2 import (
    silver_gitcoin2_grant_pools,
    silver_gitcoin2_projects,
    silver_gitcoin2_grant_applications,
    silver_gitcoin2_donations,
    silver_gitcoin2_payouts,
    silver_gitcoin2_attestations,
)

# --- Sensors ---
from sensors.scf_sensor import airtable_scf_sensor

# --- Resources ---
from resources.database import database_engine_resource

# --- Gold (dbt) Assets ---
from dagster import AssetExecutionContext, AssetKey
from dagster_dbt import DagsterDbtTranslator

DBT_PROJECT_DIR = Path("/app/dbt_project")
MANIFEST_PATH = DBT_PROJECT_DIR / "target" / "manifest.json"

dbt_resource = DbtCliResource(
    project_dir=DBT_PROJECT_DIR,
    profiles_dir=DBT_PROJECT_DIR,
    target=os.getenv("DBT_TARGET", "dev_postgres"),
)


class _DbtTranslator(DagsterDbtTranslator):
    """Map dbt source nodes to the same asset keys as the upstream Python assets.

    By default dagster-dbt prefixes source keys with the source schema name,
    e.g. source('silver', 'silver_scf_projects') → AssetKey(['silver', 'silver_scf_projects']).
    Our Python assets use single-part keys (AssetKey(['silver_scf_projects'])),
    so the lineage edge is never drawn.  This translator strips the prefix.
    """

    def get_asset_key(self, dbt_resource_props: dict) -> AssetKey:
        if dbt_resource_props.get("resource_type") == "source":
            return AssetKey([dbt_resource_props["name"]])
        return super().get_asset_key(dbt_resource_props)


@dbt_assets(manifest=MANIFEST_PATH, select="tag:gold", dagster_dbt_translator=_DbtTranslator(), group_name="gold_dbt")
def gold_dbt_assets(context: AssetExecutionContext, dbt: DbtCliResource):
    """Run dbt models tagged with 'gold' for analytics layer."""
    yield from dbt.cli(["build"], context=context).stream()


# =============================================================================
# Bronze Jobs
# =============================================================================

bronze_ens_job = define_asset_job(
    name="bronze_ens_job",
    selection=AssetSelection.assets(fetch_ens_data),
    description="Ingest ENS Small Grants JSON data into the Bronze layer.",
)

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

bronze_gitcoin2_job = define_asset_job(
    name="bronze_gitcoin2_job",
    selection=AssetSelection.assets(load_gitcoin2_csv_data),
    description="Load Gitcoin 2.0 historical CSV snapshot into Bronze layer.",
)


# =============================================================================
# Silver Jobs
# =============================================================================

silver_ens_etl_job = define_asset_job(
    name="silver_ens_etl_job",
    selection=AssetSelection.assets(
        silver_ens_grant_pools,
        silver_ens_projects,
    ),
    description="Transform ENS Small Grants data into the Silver layer.",
)

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

silver_gitcoin2_etl_job = define_asset_job(
    name="silver_gitcoin2_etl_job",
    selection=AssetSelection.assets(
        silver_gitcoin2_grant_pools,
        silver_gitcoin2_projects,
        silver_gitcoin2_grant_applications,
        silver_gitcoin2_donations,
        silver_gitcoin2_payouts,
        silver_gitcoin2_attestations,
    ),
    executor_def=multiprocess_executor.configured({"max_concurrent": 1}),
    description="Transform Gitcoin 2.0 CSV data into DAOIP-5 compliant Silver layer with co.gitcoin extensions (sequential to stay within 2GB RAM).",
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
# Full Pipeline Jobs (bronze -> silver -> gold)
# =============================================================================

etl_ens_full_job = define_asset_job(
    name="etl_ens_full_job",
    selection=AssetSelection.assets(
        fetch_ens_data,
        silver_ens_grant_pools,
        silver_ens_projects,
    ) | AssetSelection.assets(gold_dbt_assets),
    description="Full ENS pipeline: JSON files -> Bronze -> Silver -> Gold (dbt).",
)

etl_scf_full_job = define_asset_job(
    name="etl_scf_full_job",
    selection=AssetSelection.assets(
        bronze_scf_airtable_ingest,
        silver_scf_projects,
        silver_scf_grant_applications,
        silver_scf_grant_pools,
    ) | AssetSelection.assets(gold_dbt_assets),
    description="Full SCF pipeline: Airtable -> Bronze -> Silver -> Gold (dbt).",
)

etl_giveth_full_job = define_asset_job(
    name="etl_giveth_full_job",
    selection=AssetSelection.assets(
        fetch_giveth_data,
        silver_giveth_projects,
        silver_giveth_grant_pools,
    ) | AssetSelection.assets(gold_dbt_assets),
    description="Full Giveth pipeline: API -> Bronze -> Silver -> Gold (dbt).",
)

etl_privote_full_job = define_asset_job(
    name="etl_privote_full_job",
    selection=AssetSelection.assets(
        fetch_privote_data,
        silver_privote_transform,
    ) | AssetSelection.assets(gold_dbt_assets),
    description="Full Privote pipeline: Subgraph -> Bronze -> Silver -> Gold (dbt).",
)

etl_gitcoin2_full_job = define_asset_job(
    name="etl_gitcoin2_full_job",
    selection=AssetSelection.assets(
        load_gitcoin2_csv_data,
        silver_gitcoin2_grant_pools,
        silver_gitcoin2_projects,
        silver_gitcoin2_grant_applications,
        silver_gitcoin2_donations,
        silver_gitcoin2_payouts,
        silver_gitcoin2_attestations,
    ) | AssetSelection.assets(gold_dbt_assets),
    description="Full Gitcoin 2.0 pipeline: CSV files -> Bronze -> Silver -> Gold (dbt).",
)

# =============================================================================
# Unified Definitions
# =============================================================================

defs = Definitions(
    assets=[
        # Bronze
        fetch_ens_data,
        fetch_giveth_data,
        fetch_privote_data,
        bronze_scf_airtable_ingest,
        load_gitcoin2_csv_data,
        # Silver
        silver_ens_grant_pools,
        silver_ens_projects,
        silver_giveth_projects,
        silver_giveth_grant_pools,
        silver_privote_transform,
        silver_scf_projects,
        silver_scf_grant_applications,
        silver_scf_grant_pools,
        silver_gitcoin2_grant_pools,
        silver_gitcoin2_projects,
        silver_gitcoin2_grant_applications,
        silver_gitcoin2_donations,
        silver_gitcoin2_payouts,
        silver_gitcoin2_attestations,
        # Gold
        gold_dbt_assets,
    ],
    resources={
        "database_engine": database_engine_resource,
        "dbt": dbt_resource,
    },
    jobs=[
        # Bronze
        bronze_ens_job,
        bronze_giveth_job,
        bronze_privote_job,
        bronze_scf_job,
        bronze_gitcoin2_job,
        # Silver
        silver_ens_etl_job,
        silver_giveth_etl_job,
        silver_scf_etl_job,
        silver_privote_etl_job,
        silver_gitcoin2_etl_job,
        # Gold
        gold_dbt_job,
        # Full pipeline
        etl_ens_full_job,
        etl_scf_full_job,
        etl_giveth_full_job,
        etl_privote_full_job,
        etl_gitcoin2_full_job,
    ],
    sensors=[
        airtable_scf_sensor,
    ],
)
