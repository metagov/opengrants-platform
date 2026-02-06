# og_dagster/assets/silver/grantsstack/grantsstack.py
"""
Silver layer assets for GrantStack (Gitcoin Grants Stack).

Transforms bronze tables to DAOIP-5 compliant silver tables:
- bronze_grantsstack_rounds -> silver_grantsstack_grant_pools
- bronze_grantsstack_projects -> silver_grantsstack_projects
- bronze_grantsstack_applications -> silver_grantsstack_grant_applications
- bronze_grantsstack_donations -> silver_grantsstack_donations
"""

from dagster import Output, asset
from utils.db import drop_dependent_views
from utils.translate_to_silver import build_silver

SCHEMA_PATH = "/app/configs/schema_maps/active/daoip5_grantsstack.yaml"


@asset(
    name="silver__grantsstack_grant_pools",
    description="DAOIP-5 compliant GrantPool schema for GrantStack rounds",
    required_resource_keys={"database_engine"},
    deps=["bronze__grantsstack_rounds"],
    compute_kind="transformation",
    group_name="silver_grantsstack",
)
def silver_grantsstack_grant_pools(context):
    """Transform GrantStack rounds to DAOIP-5 GrantPool schema."""
    engine = context.resources.database_engine

    context.log.info("Building silver_grantsstack_grant_pools from bronze_grantsstack_rounds...")

    df_silver = build_silver(
        engine=engine,
        schema_path=SCHEMA_PATH,
        section="grant_pools",
    )

    drop_dependent_views(engine, "silver_grantsstack_grant_pools", context)

    df_silver.write_database(
        table_name="silver_grantsstack_grant_pools",
        connection=engine,
        if_table_exists="replace",
    )

    context.log.info(f"Saved {df_silver.height} rows to silver_grantsstack_grant_pools")
    return Output(df_silver)


@asset(
    name="silver__grantsstack_projects",
    description="DAOIP-5 compliant Project schema for GrantStack projects",
    required_resource_keys={"database_engine"},
    deps=["bronze__grantsstack_projects"],
    compute_kind="transformation",
    group_name="silver_grantsstack",
)
def silver_grantsstack_projects(context):
    """Transform GrantStack projects to DAOIP-5 Project schema."""
    engine = context.resources.database_engine

    context.log.info("Building silver_grantsstack_projects from bronze_grantsstack_projects...")

    df_silver = build_silver(
        engine=engine,
        schema_path=SCHEMA_PATH,
        section="projects",
    )

    drop_dependent_views(engine, "silver_grantsstack_projects", context)

    df_silver.write_database(
        table_name="silver_grantsstack_projects",
        connection=engine,
        if_table_exists="replace",
    )

    context.log.info(f"Saved {df_silver.height} rows to silver_grantsstack_projects")
    return Output(df_silver)


@asset(
    name="silver__grantsstack_grant_applications",
    description="DAOIP-5 compliant GrantApplication schema for GrantStack applications",
    required_resource_keys={"database_engine"},
    deps=["bronze__grantsstack_applications"],
    compute_kind="transformation",
    group_name="silver_grantsstack",
)
def silver_grantsstack_grant_applications(context):
    """Transform GrantStack applications to DAOIP-5 GrantApplication schema."""
    engine = context.resources.database_engine

    context.log.info("Building silver_grantsstack_grant_applications from bronze_grantsstack_applications...")

    df_silver = build_silver(
        engine=engine,
        schema_path=SCHEMA_PATH,
        section="grant_applications",
    )

    drop_dependent_views(engine, "silver_grantsstack_grant_applications", context)

    df_silver.write_database(
        table_name="silver_grantsstack_grant_applications",
        connection=engine,
        if_table_exists="replace",
    )

    context.log.info(f"Saved {df_silver.height} rows to silver_grantsstack_grant_applications")
    return Output(df_silver)


@asset(
    name="silver__grantsstack_donations",
    description="GrantStack donations with DAOIP-5 compatible identifiers",
    required_resource_keys={"database_engine"},
    deps=["bronze__grantsstack_donations"],
    compute_kind="transformation",
    group_name="silver_grantsstack",
)
def silver_grantsstack_donations(context):
    """Transform GrantStack donations to silver layer with DAOIP-5 identifiers."""
    engine = context.resources.database_engine

    context.log.info("Building silver_grantsstack_donations from bronze_grantsstack_donations...")

    df_silver = build_silver(
        engine=engine,
        schema_path=SCHEMA_PATH,
        section="donations",
    )

    drop_dependent_views(engine, "silver_grantsstack_donations", context)

    df_silver.write_database(
        table_name="silver_grantsstack_donations",
        connection=engine,
        if_table_exists="replace",
    )

    context.log.info(f"Saved {df_silver.height} rows to silver_grantsstack_donations")
    return Output(df_silver)


@asset(
    name="silver__grantsstack_payouts",
    description="DAOIP-5 compliant payouts for GrantStack applications",
    required_resource_keys={"database_engine"},
    deps=["bronze__grantsstack_payouts"],
    compute_kind="transformation",
    group_name="silver_grantsstack",
)
def silver_grantsstack_payouts(context):
    """Transform GrantStack payouts to DAOIP-5 compliant payout schema."""
    engine = context.resources.database_engine

    context.log.info("Building silver_grantsstack_payouts from bronze_grantsstack_payouts...")

    df_silver = build_silver(
        engine=engine,
        schema_path=SCHEMA_PATH,
        section="payouts",
    )

    drop_dependent_views(engine, "silver_grantsstack_payouts", context)

    df_silver.write_database(
        table_name="silver_grantsstack_payouts",
        connection=engine,
        if_table_exists="replace",
    )

    context.log.info(f"Saved {df_silver.height} rows to silver_grantsstack_payouts")
    return Output(df_silver)
