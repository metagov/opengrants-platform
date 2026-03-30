# og_dagster/assets/silver/gitcoin2/gitcoin2.py
"""
Silver layer assets for Gitcoin 2.0 (CSV snapshot).

6 DAOIP-5 silver tables:
  bronze_gitcoin2_rounds        -> silver_gitcoin2_grant_pools      (GrantPool)
  bronze_gitcoin2_projects      -> silver_gitcoin2_projects          (Project)
  bronze_gitcoin2_applications  -> silver_gitcoin2_grant_applications (GrantApplication)
  bronze_gitcoin2_donations     -> silver_gitcoin2_donations          (custom donation schema)
  bronze_gitcoin2_payouts       -> silver_gitcoin2_payouts            (GrantApplication.payouts)
  bronze_gitcoin2_attestations  -> silver_gitcoin2_attestations       (DAOIP-3 attestation)

Each silver table is then enriched with related bronze reference tables
as co.gitcoin.* extension columns:
  grant_pools  <- round_roles (co.gitcoin.roundRoles)
               <- pending_round_roles (co.gitcoin.pendingRoundRoles)
               <- strategy_timings (co.gitcoin.strategyTimings)
  projects     <- project_roles (co.gitcoin.projectRoles)
               <- legacy_projects (co.gitcoin.legacyProjectId, co.gitcoin.v1ChainId)
  attestations <- attestation_txns (co.gitcoin.txHash)

Bronze-only (no DAOIP-5 value, operational reference data):
  bronze_gitcoin2_metadata_cache      (IPFS cache)
  bronze_gitcoin2_price_cache         (token price history)
  bronze_gitcoin2_strategies_registry (contract registry)
  bronze_gitcoin2_events_registry     (raw event log)
"""

import os

from dagster import Output, asset
from sqlalchemy import text
from utils.data_quality import write_data_quality_report
from utils.db import drop_table_cascade
from utils.translate_to_silver import build_silver

SCHEMA_PATH = "/app/configs/schema_maps/active/daoip5_gitcoin2.yaml"

# When GITCOIN2_OBSERVE_ONLY=true, skip ETL and register existing silver tables
# in Dagster's event log. Use this when silver tables already exist in the DB
# but Dagster shows them as unmaterialized (e.g. after a killed run).
GITCOIN2_OBSERVE_ONLY = os.getenv("GITCOIN2_OBSERVE_ONLY", "false").lower() == "true"

SILVER_TABLES = [
    "silver_gitcoin2_grant_pools",
    "silver_gitcoin2_projects",
    "silver_gitcoin2_grant_applications",
    "silver_gitcoin2_donations",
    "silver_gitcoin2_payouts",
    "silver_gitcoin2_attestations",
]


def _observe_row_count(engine, table_name: str) -> int:
    """Return row count for table, or 0 if it doesn't exist."""
    with engine.connect() as conn:
        exists = conn.execute(text(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables "
            "WHERE table_schema='public' AND table_name=:t)"
        ), {"t": table_name}).scalar()
        if not exists:
            return 0
        return conn.execute(text(f'SELECT COUNT(*) FROM "{table_name}"')).scalar()


def _maybe_observe(context, table_name: str) -> Output | None:
    """
    If GITCOIN2_OBSERVE_ONLY=true, check the table exists and return an Output
    so Dagster marks it materialized. Returns None if full ETL should run.
    """
    if not GITCOIN2_OBSERVE_ONLY:
        return None
    engine = context.resources.database_engine
    count = _observe_row_count(engine, table_name)
    if count == 0:
        raise Exception(
            f"Observe mode: {table_name} is missing or empty. "
            "Run silver_gitcoin2_etl_job with GITCOIN2_OBSERVE_ONLY=false to populate it."
        )
    context.log.info(f"GITCOIN2_OBSERVE_ONLY=true — {table_name}: {count} rows (already materialized)")
    return Output(count, metadata={"row_count": count})


# ============================================================
# ENRICHMENT HELPERS
# ============================================================

def _enrich_grant_pools(engine, context):
    """Enrich silver_gitcoin2_grant_pools with roles and strategy timings."""
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE silver_gitcoin2_grant_pools
                ADD COLUMN IF NOT EXISTS "co.gitcoin.roundRoles"         TEXT,
                ADD COLUMN IF NOT EXISTS "co.gitcoin.pendingRoundRoles"  TEXT,
                ADD COLUMN IF NOT EXISTS "co.gitcoin.strategyTimings"    TEXT
        """))

        # round_roles: aggregate {address, role} per (round_id, chain_id)
        conn.execute(text("""
            UPDATE silver_gitcoin2_grant_pools gp
            SET "co.gitcoin.roundRoles" = r.roles
            FROM (
                SELECT round_id::text, chain_id::text,
                       json_agg(json_build_object(
                           'address', address,
                           'role',    role,
                           'createdAtBlock', created_at_block
                       ))::text AS roles
                FROM bronze_gitcoin2_round_roles
                GROUP BY round_id, chain_id
            ) r
            WHERE gp.id = 'daoip-5:gitcoin2:grantPool:' || r.round_id
              AND gp."co.gitcoin.chainId"::text = r.chain_id
        """))

        # pending_round_roles: aggregate by chain_id (no direct round_id link)
        conn.execute(text("""
            UPDATE silver_gitcoin2_grant_pools gp
            SET "co.gitcoin.pendingRoundRoles" = pr.roles
            FROM (
                SELECT chain_id::text,
                       json_agg(json_build_object(
                           'address', address,
                           'role',    role,
                           'createdAtBlock', created_at_block
                       ))::text AS roles
                FROM bronze_gitcoin2_pending_round_roles
                GROUP BY chain_id
            ) pr
            WHERE gp."co.gitcoin.chainId"::text = pr.chain_id
        """))

        # strategy_timings: join on strategy_id or strategy_address
        conn.execute(text("""
            UPDATE silver_gitcoin2_grant_pools gp
            SET "co.gitcoin.strategyTimings" = st.timings
            FROM bronze_gitcoin2_strategy_timings st
            WHERE gp."co.gitcoin.strategyId"      = st.strategy_id
               OR gp."co.gitcoin.strategyAddress" = st.address
        """))

        conn.commit()

    context.log.info("Enriched silver_gitcoin2_grant_pools with round roles and strategy timings")


def _enrich_projects(engine, context):
    """Enrich silver_gitcoin2_projects with project roles and legacy IDs."""
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE silver_gitcoin2_projects
                ADD COLUMN IF NOT EXISTS "co.gitcoin.projectRoles"   TEXT,
                ADD COLUMN IF NOT EXISTS "co.gitcoin.legacyProjectId" TEXT,
                ADD COLUMN IF NOT EXISTS "co.gitcoin.v1ChainId"      TEXT
        """))

        # project_roles: aggregate {address, role} per (project_id, chain_id)
        conn.execute(text("""
            UPDATE silver_gitcoin2_projects sp
            SET "co.gitcoin.projectRoles" = r.roles
            FROM (
                SELECT project_id, chain_id::text,
                       json_agg(json_build_object(
                           'address', address,
                           'role',    role,
                           'createdAtBlock', created_at_block
                       ))::text AS roles
                FROM bronze_gitcoin2_project_roles
                GROUP BY project_id, chain_id
            ) r
            WHERE sp.id = 'daoip-5:gitcoin2:project:' || r.project_id
              AND sp."co.gitcoin.chainId"::text = r.chain_id
        """))

        # legacy_projects: v2_project_id -> v1_project_id + v1_chain_id
        conn.execute(text("""
            UPDATE silver_gitcoin2_projects sp
            SET "co.gitcoin.legacyProjectId" = lp.v1_project_id,
                "co.gitcoin.v1ChainId"       = lp.v1_chain_id
            FROM bronze_gitcoin2_legacy_projects lp
            WHERE sp.id = 'daoip-5:gitcoin2:project:' || lp.v2_project_id
        """))

        conn.commit()

    context.log.info("Enriched silver_gitcoin2_projects with project roles and legacy IDs")


def _enrich_attestations(engine, context):
    """Enrich silver_gitcoin2_attestations with on-chain transaction hash."""
    with engine.connect() as conn:
        conn.execute(text("""
            ALTER TABLE silver_gitcoin2_attestations
                ADD COLUMN IF NOT EXISTS "co.gitcoin.txHash" TEXT
        """))

        conn.execute(text("""
            UPDATE silver_gitcoin2_attestations sa
            SET "co.gitcoin.txHash" = at.txn_hash
            FROM bronze_gitcoin2_attestation_txns at
            WHERE sa.id = 'daoip-5:gitcoin2:attestation:' || at.attestation_uid
              AND sa."co.gitcoin.chainId"::text = at.attestation_chain_id::text
        """))

        conn.commit()

    context.log.info("Enriched silver_gitcoin2_attestations with transaction hashes")


# ============================================================
# DAOIP-5 SILVER ASSETS
# ============================================================

@asset(
    name="silver__gitcoin2_grant_pools",
    description="DAOIP-5 GrantPool schema for Gitcoin 2.0 rounds, enriched with round roles and strategy timings",
    required_resource_keys={"database_engine"},
    deps=["bronze__gitcoin2_rounds"],
    compute_kind="transformation",
    group_name="silver_gitcoin2",
)
def silver_gitcoin2_grant_pools(context):
    obs = _maybe_observe(context, "silver_gitcoin2_grant_pools")
    if obs is not None:
        return obs
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_grant_pools...")
    df_silver, null_issues = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="grant_pools")
    drop_table_cascade(engine, "silver_gitcoin2_grant_pools", context)
    df_silver.write_database(table_name="silver_gitcoin2_grant_pools", connection=engine, if_table_exists="replace")
    context.log.info(f"Wrote {df_silver.height} rows — enriching with roles + timings...")
    _enrich_grant_pools(engine, context)
    write_data_quality_report("gitcoin2", "silver_gitcoin2_grant_pools", df_silver.height, null_issues, [], context.run_id)
    return Output(df_silver)


@asset(
    name="silver__gitcoin2_projects",
    description="DAOIP-5 Project schema for Gitcoin 2.0, enriched with project roles and legacy IDs",
    required_resource_keys={"database_engine"},
    deps=["bronze__gitcoin2_projects"],
    compute_kind="transformation",
    group_name="silver_gitcoin2",
)
def silver_gitcoin2_projects(context):
    obs = _maybe_observe(context, "silver_gitcoin2_projects")
    if obs is not None:
        return obs
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_projects...")
    df_silver, null_issues = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="projects")
    drop_table_cascade(engine, "silver_gitcoin2_projects", context)
    df_silver.write_database(table_name="silver_gitcoin2_projects", connection=engine, if_table_exists="replace")
    context.log.info(f"Wrote {df_silver.height} rows — enriching with roles + legacy IDs...")
    _enrich_projects(engine, context)
    write_data_quality_report("gitcoin2", "silver_gitcoin2_projects", df_silver.height, null_issues, [], context.run_id)
    return Output(df_silver)


@asset(
    name="silver__gitcoin2_grant_applications",
    description="DAOIP-5 GrantApplication schema for Gitcoin 2.0 applications",
    required_resource_keys={"database_engine"},
    deps=["bronze__gitcoin2_applications"],
    compute_kind="transformation",
    group_name="silver_gitcoin2",
)
def silver_gitcoin2_grant_applications(context):
    obs = _maybe_observe(context, "silver_gitcoin2_grant_applications")
    if obs is not None:
        return obs
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_grant_applications...")
    df_silver, null_issues = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="grant_applications")
    drop_table_cascade(engine, "silver_gitcoin2_grant_applications", context)
    df_silver.write_database(table_name="silver_gitcoin2_grant_applications", connection=engine, if_table_exists="replace")
    context.log.info(f"Saved {df_silver.height} rows to silver_gitcoin2_grant_applications")
    write_data_quality_report("gitcoin2", "silver_gitcoin2_grant_applications", df_silver.height, null_issues, [], context.run_id)
    return Output(df_silver)


@asset(
    name="silver__gitcoin2_donations",
    description="Gitcoin 2.0 donations with DAOIP-5 compatible identifiers",
    required_resource_keys={"database_engine"},
    deps=["bronze__gitcoin2_donations"],
    compute_kind="transformation",
    group_name="silver_gitcoin2",
)
def silver_gitcoin2_donations(context):
    obs = _maybe_observe(context, "silver_gitcoin2_donations")
    if obs is not None:
        return obs
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_donations...")
    df_silver, null_issues = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="donations")
    drop_table_cascade(engine, "silver_gitcoin2_donations", context)
    df_silver.write_database(table_name="silver_gitcoin2_donations", connection=engine, if_table_exists="replace")
    context.log.info(f"Saved {df_silver.height} rows to silver_gitcoin2_donations")
    write_data_quality_report("gitcoin2", "silver_gitcoin2_donations", df_silver.height, null_issues, [], context.run_id)
    return Output(df_silver)


@asset(
    name="silver__gitcoin2_payouts",
    description="DAOIP-5 compliant payouts for Gitcoin 2.0 applications",
    required_resource_keys={"database_engine"},
    deps=["bronze__gitcoin2_payouts"],
    compute_kind="transformation",
    group_name="silver_gitcoin2",
)
def silver_gitcoin2_payouts(context):
    obs = _maybe_observe(context, "silver_gitcoin2_payouts")
    if obs is not None:
        return obs
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_payouts...")
    df_silver, null_issues = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="payouts")
    drop_table_cascade(engine, "silver_gitcoin2_payouts", context)
    df_silver.write_database(table_name="silver_gitcoin2_payouts", connection=engine, if_table_exists="replace")
    context.log.info(f"Saved {df_silver.height} rows to silver_gitcoin2_payouts")
    write_data_quality_report("gitcoin2", "silver_gitcoin2_payouts", df_silver.height, null_issues, [], context.run_id)
    return Output(df_silver)


@asset(
    name="silver__gitcoin2_attestations",
    description="DAOIP-3 attestation schema for Gitcoin 2.0, enriched with on-chain transaction hashes",
    required_resource_keys={"database_engine"},
    deps=["bronze__gitcoin2_attestations"],
    compute_kind="transformation",
    group_name="silver_gitcoin2",
)
def silver_gitcoin2_attestations(context):
    obs = _maybe_observe(context, "silver_gitcoin2_attestations")
    if obs is not None:
        return obs
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_attestations...")
    df_silver, null_issues = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="attestations")
    drop_table_cascade(engine, "silver_gitcoin2_attestations", context)
    df_silver.write_database(table_name="silver_gitcoin2_attestations", connection=engine, if_table_exists="replace")
    context.log.info(f"Wrote {df_silver.height} rows — enriching with tx hashes...")
    _enrich_attestations(engine, context)
    write_data_quality_report("gitcoin2", "silver_gitcoin2_attestations", df_silver.height, null_issues, [], context.run_id)
    return Output(df_silver)
