# og_dagster/assets/silver/gitcoin2/gitcoin2.py
"""
Silver layer assets for Gitcoin 2.0 (CSV snapshot).

Transforms bronze CSV tables to DAOIP-5 compliant silver tables:
- bronze_gitcoin2_rounds        -> silver_gitcoin2_grant_pools
- bronze_gitcoin2_projects      -> silver_gitcoin2_projects
- bronze_gitcoin2_applications  -> silver_gitcoin2_grant_applications
- bronze_gitcoin2_donations     -> silver_gitcoin2_donations
- bronze_gitcoin2_payouts       -> silver_gitcoin2_payouts
"""

from dagster import Output, asset
from utils.db import drop_table_cascade
from utils.translate_to_silver import build_silver

SCHEMA_PATH = "/app/configs/schema_maps/active/daoip5_gitcoin2.yaml"


@asset(
    name="silver__gitcoin2_grant_pools",
    description="DAOIP-5 compliant GrantPool schema for Gitcoin 2.0 rounds",
    required_resource_keys={"database_engine"},
    deps=["bronze__gitcoin2_rounds"],
    compute_kind="transformation",
    group_name="silver_gitcoin2",
)
def silver_gitcoin2_grant_pools(context):
    """Transform Gitcoin2 rounds CSV to DAOIP-5 GrantPool schema."""
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_grant_pools from bronze_gitcoin2_rounds...")

    df_silver = build_silver(
        engine=engine,
        schema_path=SCHEMA_PATH,
        section="grant_pools",
    )

    drop_table_cascade(engine, "silver_gitcoin2_grant_pools", context)

    df_silver.write_database(
        table_name="silver_gitcoin2_grant_pools",
        connection=engine,
        if_table_exists="replace",
    )

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
    """Transform Gitcoin2 projects CSV to DAOIP-5 Project schema."""
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_projects from bronze_gitcoin2_projects...")

    df_silver = build_silver(
        engine=engine,
        schema_path=SCHEMA_PATH,
        section="projects",
    )

    drop_table_cascade(engine, "silver_gitcoin2_projects", context)

    df_silver.write_database(
        table_name="silver_gitcoin2_projects",
        connection=engine,
        if_table_exists="replace",
    )

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
    """Transform Gitcoin2 applications CSV to DAOIP-5 GrantApplication schema."""
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_grant_applications from bronze_gitcoin2_applications...")

    df_silver = build_silver(
        engine=engine,
        schema_path=SCHEMA_PATH,
        section="grant_applications",
    )

    drop_table_cascade(engine, "silver_gitcoin2_grant_applications", context)

    df_silver.write_database(
        table_name="silver_gitcoin2_grant_applications",
        connection=engine,
        if_table_exists="replace",
    )

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
    """Transform Gitcoin2 donations CSV to silver layer with DAOIP-5 identifiers."""
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_donations from bronze_gitcoin2_donations...")

    df_silver = build_silver(
        engine=engine,
        schema_path=SCHEMA_PATH,
        section="donations",
    )

    drop_table_cascade(engine, "silver_gitcoin2_donations", context)

    df_silver.write_database(
        table_name="silver_gitcoin2_donations",
        connection=engine,
        if_table_exists="replace",
    )

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
    """Transform Gitcoin2 payouts CSV to DAOIP-5 compliant payout schema."""
    engine = context.resources.database_engine
    context.log.info("Building silver_gitcoin2_payouts from bronze_gitcoin2_payouts...")

    df_silver = build_silver(
        engine=engine,
        schema_path=SCHEMA_PATH,
        section="payouts",
    )

    drop_table_cascade(engine, "silver_gitcoin2_payouts", context)

    df_silver.write_database(
        table_name="silver_gitcoin2_payouts",
        connection=engine,
        if_table_exists="replace",
    )

    context.log.info(f"Saved {df_silver.height} rows to silver_gitcoin2_payouts")
    return Output(df_silver)
