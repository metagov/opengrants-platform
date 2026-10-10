from dagster import AssetKey, Failure, MetadataValue, asset
from utils.data_quality import write_data_quality_report
from utils.translate_to_silver import build_silver
from utils.graphql_helpers import sanitize_for_sql
from utils.scf_archive import record_published_ids
from utils.scf_validation import (
    OVERRIDE_TAG,
    SECTIONS,
    record_validation,
    validate_scf_candidates,
    write_report,
)

SCHEMA_PATH = "/app/configs/schema_maps/active/daoip5_scf.yaml"


def _run_tags(context) -> dict:
    try:
        return dict(context.run.tags)
    except Exception:  # direct invocation (tests) has no run
        return {}


@asset(
    group_name="silver",
    required_resource_keys={"database_engine"},
    deps=[AssetKey("bronze_scf_airtable_ingest")],
    description=(
        "Builds candidate SCF silver tables and checks them for accuracy against each other and "
        "against the live tables. Nothing downstream is published if a blocking check fails."
    ),
)
def silver_scf_validation_gate(context):
    engine = context.resources.database_engine
    frames, null_issues = {}, {}
    for section in SECTIONS:
        df, null_issues[section] = build_silver(engine=engine, schema_path=SCHEMA_PATH, section=section)
        frames[section] = sanitize_for_sql(df)

    result = validate_scf_candidates(engine, frames)
    override = _run_tags(context).get(OVERRIDE_TAG, "").lower() == "true"
    status = record_validation(engine, result, context.run_id, overridden=override)
    report = write_report(result, context.run_id, status)

    for f in result.warnings:
        context.log.warning(f"[{f.table}] {f.check}: {f.message}")
    for f in result.blocking:
        context.log.error(f"[{f.table}] {f.check}: {f.message}")

    if status == "blocked":
        raise Failure(
            description=(
                f"SCF data failed {len(result.blocking)} accuracy checks; live tables were not changed. "
                f"Review the findings, then fix Airtable or re-run with tag {OVERRIDE_TAG}=true."
            ),
            metadata={
                "blocking": MetadataValue.md("\n".join(f"- **{f.table}** {f.check}: {f.message}" for f in result.blocking)),
                "report": str(report) if report else "not written",
            },
        )
    if status == "overridden":
        context.log.warning(f"{len(result.blocking)} blocking findings overridden by run tag {OVERRIDE_TAG}")

    context.add_output_metadata({
        "status": status,
        "warnings": len(result.warnings),
        "report": str(report) if report else "not written",
    })
    return {"frames": frames, "null_issues": null_issues}


@asset(
    group_name="silver",
    required_resource_keys={"database_engine"},
)
def silver_scf_projects(context, silver_scf_validation_gate):
    # Publish exactly the frame the gate validated.
    df_silver = silver_scf_validation_gate["frames"]["projects"]
    null_issues = silver_scf_validation_gate["null_issues"]["projects"]
    df_silver.write_database(
        table_name="silver_scf_projects",
        connection=context.resources.database_engine,
        if_table_exists="replace",
    )
    write_data_quality_report("scf", "silver_scf_projects", df_silver.height, null_issues, [], context.run_id)
    new_ids = record_published_ids(
        context.resources.database_engine, "project", df_silver.select(["id", "name"]).iter_rows()
    )
    context.log.info(f"{new_ids} new DAOIP-5 project IDs recorded in the published-ID archive")

    return df_silver


@asset(
    group_name="silver",
    required_resource_keys={"database_engine"},
)
def silver_scf_grant_applications(context, silver_scf_validation_gate):
    # Publish exactly the frame the gate validated.
    df_silver = silver_scf_validation_gate["frames"]["grant_applications"]
    null_issues = silver_scf_validation_gate["null_issues"]["grant_applications"]
    df_silver.write_database(
        table_name="silver_scf_grant_applications",
        connection=context.resources.database_engine,
        if_table_exists="replace",
    )
    write_data_quality_report("scf", "silver_scf_grant_applications", df_silver.height, null_issues, [], context.run_id)
    new_ids = record_published_ids(
        context.resources.database_engine, "grantApplication", df_silver.select(["id", "name"]).iter_rows()
    )
    context.log.info(f"{new_ids} new DAOIP-5 grantApplication IDs recorded in the published-ID archive")

    return df_silver


@asset(
    group_name="silver",
    required_resource_keys={"database_engine"},
)
def silver_scf_grant_pools(context, silver_scf_validation_gate):
    # Publish exactly the frame the gate validated.
    df_silver = silver_scf_validation_gate["frames"]["grant_pools"]
    null_issues = silver_scf_validation_gate["null_issues"]["grant_pools"]
    df_silver.write_database(
        table_name="silver_scf_grant_pools",
        connection=context.resources.database_engine,
        if_table_exists="replace",
    )
    write_data_quality_report("scf", "silver_scf_grant_pools", df_silver.height, null_issues, [], context.run_id)
    new_ids = record_published_ids(
        context.resources.database_engine, "grantPool", df_silver.select(["id", "name"]).iter_rows()
    )
    context.log.info(f"{new_ids} new DAOIP-5 grantPool IDs recorded in the published-ID archive")

    return df_silver