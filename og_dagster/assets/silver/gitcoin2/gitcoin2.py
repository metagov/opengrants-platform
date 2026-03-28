# og_dagster/assets/silver/gitcoin2/gitcoin2.py
"""
Silver layer assets for Gitcoin 2.0 (CSV snapshot).

DAOIP-5 mapped (6 tables):
- bronze_gitcoin2_rounds        -> silver_gitcoin2_grant_pools      (GrantPool)
- bronze_gitcoin2_projects      -> silver_gitcoin2_projects          (Project)
- bronze_gitcoin2_applications  -> silver_gitcoin2_grant_applications (GrantApplication)
- bronze_gitcoin2_donations     -> silver_gitcoin2_donations          (custom donation schema)
- bronze_gitcoin2_payouts       -> silver_gitcoin2_payouts            (GrantApplication.payouts)
- bronze_gitcoin2_attestations  -> silver_gitcoin2_attestations       (DAOIP-3 attestation)

Passthrough silver (10 tables — reference/operational data, no DAOIP-5 equivalent):
- bronze_gitcoin2_metadata_cache      -> silver_gitcoin2_metadata_cache
- bronze_gitcoin2_price_cache         -> silver_gitcoin2_price_cache
- bronze_gitcoin2_legacy_projects     -> silver_gitcoin2_legacy_projects
- bronze_gitcoin2_attestation_txns    -> silver_gitcoin2_attestation_txns
- bronze_gitcoin2_project_roles       -> silver_gitcoin2_project_roles
- bronze_gitcoin2_round_roles         -> silver_gitcoin2_round_roles
- bronze_gitcoin2_pending_round_roles -> silver_gitcoin2_pending_round_roles
- bronze_gitcoin2_strategies_registry -> silver_gitcoin2_strategies_registry
- bronze_gitcoin2_strategy_timings    -> silver_gitcoin2_strategy_timings
- bronze_gitcoin2_events_registry     -> silver_gitcoin2_events_registry
"""

from dagster import Output, asset
from sqlalchemy import text
from utils.db import drop_table_cascade, get_pg_engine
from utils.translate_to_silver import build_silver

SCHEMA_PATH = "/app/configs/schema_maps/active/daoip5_gitcoin2.yaml"


# ============================================================
# DAOIP-5 MAPPED ASSETS
# ============================================================

@asset(
    name="silver__gitcoin2_grant_pools",
    description="DAOIP-5 compliant GrantPool schema for Gitcoin 2.0 rounds",
    required_resource_keys={"database_engine"},
    deps=["bronze__gitcoin2_rounds"],
    compute_kind="transformation",
    group_name="silver_gitcoin2",
)
def silver_gitcoin2_grant_pools(context):
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_grant_pools from bronze_gitcoin2_rounds...")
    df_silver = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="grant_pools")
    drop_table_cascade(engine, "silver_gitcoin2_grant_pools", context)
    df_silver.write_database(table_name="silver_gitcoin2_grant_pools", connection=engine, if_table_exists="replace")
    context.log.info(f"Saved {df_silver.height} rows to silver_gitcoin2_grant_pools")
    return Output(df_silver)


@asset(
    name="silver__gitcoin2_projects",
    description="DAOIP-5 compliant Project schema for Gitcoin 2.0 projects",
    required_resource_keys={"database_engine"},
    deps=["bronze__gitcoin2_projects"],
    compute_kind="transformation",
    group_name="silver_gitcoin2",
)
def silver_gitcoin2_projects(context):
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_projects from bronze_gitcoin2_projects...")
    df_silver = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="projects")
    drop_table_cascade(engine, "silver_gitcoin2_projects", context)
    df_silver.write_database(table_name="silver_gitcoin2_projects", connection=engine, if_table_exists="replace")
    context.log.info(f"Saved {df_silver.height} rows to silver_gitcoin2_projects")
    return Output(df_silver)


@asset(
    name="silver__gitcoin2_grant_applications",
    description="DAOIP-5 compliant GrantApplication schema for Gitcoin 2.0 applications",
    required_resource_keys={"database_engine"},
    deps=["bronze__gitcoin2_applications"],
    compute_kind="transformation",
    group_name="silver_gitcoin2",
)
def silver_gitcoin2_grant_applications(context):
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_grant_applications from bronze_gitcoin2_applications...")
    df_silver = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="grant_applications")
    drop_table_cascade(engine, "silver_gitcoin2_grant_applications", context)
    df_silver.write_database(table_name="silver_gitcoin2_grant_applications", connection=engine, if_table_exists="replace")
    context.log.info(f"Saved {df_silver.height} rows to silver_gitcoin2_grant_applications")
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
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_donations from bronze_gitcoin2_donations...")
    df_silver = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="donations")
    drop_table_cascade(engine, "silver_gitcoin2_donations", context)
    df_silver.write_database(table_name="silver_gitcoin2_donations", connection=engine, if_table_exists="replace")
    context.log.info(f"Saved {df_silver.height} rows to silver_gitcoin2_donations")
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
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_payouts from bronze_gitcoin2_payouts...")
    df_silver = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="payouts")
    drop_table_cascade(engine, "silver_gitcoin2_payouts", context)
    df_silver.write_database(table_name="silver_gitcoin2_payouts", connection=engine, if_table_exists="replace")
    context.log.info(f"Saved {df_silver.height} rows to silver_gitcoin2_payouts")
    return Output(df_silver)


@asset(
    name="silver__gitcoin2_attestations",
    description="DAOIP-3 attestation schema for Gitcoin 2.0 on-chain contributor attestations",
    required_resource_keys={"database_engine"},
    deps=["bronze__gitcoin2_attestations"],
    compute_kind="transformation",
    group_name="silver_gitcoin2",
)
def silver_gitcoin2_attestations(context):
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_attestations from bronze_gitcoin2_attestations...")
    df_silver = build_silver(engine=engine, schema_path=SCHEMA_PATH, section="attestations")
    drop_table_cascade(engine, "silver_gitcoin2_attestations", context)
    df_silver.write_database(table_name="silver_gitcoin2_attestations", connection=engine, if_table_exists="replace")
    context.log.info(f"Saved {df_silver.height} rows to silver_gitcoin2_attestations")
    return Output(df_silver)


# ============================================================
# PASSTHROUGH SILVER ASSETS
# Reference/operational tables with no DAOIP-5 equivalent.
# Copied from bronze with no schema transformation.
# ============================================================

def _passthrough(engine, bronze_table: str, silver_table: str, context) -> int:
    """Copy bronze table to silver as-is (no DAOIP-5 mapping)."""
    with engine.connect() as conn:
        conn.execute(text(f'DROP TABLE IF EXISTS "{silver_table}" CASCADE'))
        conn.execute(text(f'CREATE TABLE "{silver_table}" AS SELECT * FROM "{bronze_table}"'))
        result = conn.execute(text(f'SELECT COUNT(*) FROM "{silver_table}"'))
        count = result.scalar()
        conn.commit()
    context.log.info(f"Passthrough {bronze_table} -> {silver_table}: {count} rows")
    return count


_PASSTHROUGH_TABLES = [
    ("bronze__gitcoin2_metadata_cache",      "bronze_gitcoin2_metadata_cache",      "silver_gitcoin2_metadata_cache",      "IPFS metadata cache lookup table"),
    ("bronze__gitcoin2_price_cache",         "bronze_gitcoin2_price_cache",         "silver_gitcoin2_price_cache",         "Token price history for USD normalization"),
    ("bronze__gitcoin2_legacy_projects",     "bronze_gitcoin2_legacy_projects",     "silver_gitcoin2_legacy_projects",     "v1→v2 project ID mapping table"),
    ("bronze__gitcoin2_attestation_txns",    "bronze_gitcoin2_attestation_txns",    "silver_gitcoin2_attestation_txns",    "Attestation transaction records"),
    ("bronze__gitcoin2_project_roles",       "bronze_gitcoin2_project_roles",       "silver_gitcoin2_project_roles",       "Project member roles and permissions"),
    ("bronze__gitcoin2_round_roles",         "bronze_gitcoin2_round_roles",         "silver_gitcoin2_round_roles",         "Round admin and manager roles"),
    ("bronze__gitcoin2_pending_round_roles", "bronze_gitcoin2_pending_round_roles", "silver_gitcoin2_pending_round_roles", "Pending round role assignments"),
    ("bronze__gitcoin2_strategies_registry", "bronze_gitcoin2_strategies_registry", "silver_gitcoin2_strategies_registry", "Allo strategy contract registry"),
    ("bronze__gitcoin2_strategy_timings",    "bronze_gitcoin2_strategy_timings",    "silver_gitcoin2_strategy_timings",    "Strategy-specific timing configuration"),
    ("bronze__gitcoin2_events_registry",     "bronze_gitcoin2_events_registry",     "silver_gitcoin2_events_registry",     "On-chain event log registry"),
]


def _make_passthrough_asset(asset_name, bronze_dep, bronze_table, silver_table, description):
    @asset(
        name=f"silver__{asset_name.replace('bronze__', '')}",
        description=description,
        required_resource_keys={"database_engine"},
        deps=[bronze_dep],
        compute_kind="passthrough",
        group_name="silver_gitcoin2",
    )
    def _asset(context):
        engine = context.resources.database_engine
        count = _passthrough(engine, bronze_table, silver_table, context)
        return Output(count, metadata={"row_count": count})
    return _asset


# Build all passthrough assets dynamically
silver_gitcoin2_metadata_cache      = _make_passthrough_asset(*_PASSTHROUGH_TABLES[0])
silver_gitcoin2_price_cache         = _make_passthrough_asset(*_PASSTHROUGH_TABLES[1])
silver_gitcoin2_legacy_projects     = _make_passthrough_asset(*_PASSTHROUGH_TABLES[2])
silver_gitcoin2_attestation_txns    = _make_passthrough_asset(*_PASSTHROUGH_TABLES[3])
silver_gitcoin2_project_roles       = _make_passthrough_asset(*_PASSTHROUGH_TABLES[4])
silver_gitcoin2_round_roles         = _make_passthrough_asset(*_PASSTHROUGH_TABLES[5])
silver_gitcoin2_pending_round_roles = _make_passthrough_asset(*_PASSTHROUGH_TABLES[6])
silver_gitcoin2_strategies_registry = _make_passthrough_asset(*_PASSTHROUGH_TABLES[7])
silver_gitcoin2_strategy_timings    = _make_passthrough_asset(*_PASSTHROUGH_TABLES[8])
silver_gitcoin2_events_registry     = _make_passthrough_asset(*_PASSTHROUGH_TABLES[9])
