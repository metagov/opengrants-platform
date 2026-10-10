# og_dagster/sensors/scf_sensor.py
"""
Dagster sensor that polls Airtable for SCF data changes.

Every 2 minutes it checks all 3 SCF tables for two kinds of change and
triggers the full SCF ETL pipeline (bronze -> silver -> gold) on either:

1. Records added or removed — detected via a fingerprint of every record ID.
2. Field values edited in existing records (e.g. an award amount corrected) —
   detected by asking Airtable for records whose LAST_MODIFIED_TIME() is after
   the previous check.

Note: Airtable webhooks require creator-level base access which this
token does not have. Polling record counts is reliable and sufficient.
"""

import hashlib
import json
import os
from datetime import datetime, timezone

from dagster import (
    DagsterInvariantViolationError,
    DagsterRunStatus,
    RunRequest,
    RunsFilter,
    SensorEvaluationContext,
    SkipReason,
    sensor,
)
from configs.scf_airtable import SCF_BASE_ID, SCF_REQUIRED_COLUMNS, SCF_TABLES
from utils.airtable_helpers import fetch_airtable_table


def _sentinel_field(table_name: str) -> str:
    # Fetch only a lightweight sentinel field to keep payloads small — we
    # use record IDs (always returned), not field values. The field name
    # differs per table, so pull the first required column of each table,
    # which is guaranteed to exist. Passing a field that doesn't exist
    # makes Airtable return 422 UNKNOWN_FIELD_NAME.
    return SCF_REQUIRED_COLUMNS[table_name][0]


def _get_table_fingerprint(api_key: str) -> str:
    """
    Fetch record IDs from all SCF tables and return a fingerprint hash.
    Uses record IDs only (no field data) to minimize API usage.
    """
    id_sets = []
    for table_name, table_id in sorted(SCF_TABLES.items()):
        records = fetch_airtable_table(
            base_id=SCF_BASE_ID,
            table_id=table_id,
            api_key=api_key,
            extra_params={"fields[]": _sentinel_field(table_name), "pageSize": "100"},
        )
        # Hash every record ID, so a delete + add that keeps the count
        # unchanged still changes the fingerprint.
        ids = sorted(r.get("_airtable_id", "") for r in records)
        id_sets.append(f"{table_name}:{len(ids)}:{','.join(ids)}")

    fingerprint = hashlib.md5("|".join(id_sets).encode()).hexdigest()
    return fingerprint


def _count_modified_since(api_key: str, since_iso: str) -> int:
    """
    Count records across all SCF tables whose fields were edited after
    `since_iso` (UTC, ISO-8601). Adds/removes are covered by the fingerprint;
    this catches in-place edits that leave record IDs unchanged.
    """
    formula = f"IS_AFTER(LAST_MODIFIED_TIME(), DATETIME_PARSE('{since_iso}'))"
    total = 0
    for table_name, table_id in sorted(SCF_TABLES.items()):
        records = fetch_airtable_table(
            base_id=SCF_BASE_ID,
            table_id=table_id,
            api_key=api_key,
            extra_params={
                "fields[]": _sentinel_field(table_name),
                "filterByFormula": formula,
                "pageSize": "100",
            },
        )
        total += len(records)
    return total


SCF_JOB = "etl_scf_full_job"
_ACTIVE_STATUSES = [
    DagsterRunStatus.QUEUED,
    DagsterRunStatus.NOT_STARTED,
    DagsterRunStatus.STARTING,
    DagsterRunStatus.STARTED,
]


def _scf_run_active(context: SensorEvaluationContext) -> bool:
    """True if an SCF pipeline run is queued or running. Overlapping runs would race on the
    bronze drop and the silver replace."""
    try:
        instance = context.instance
    except DagsterInvariantViolationError:  # no instance (e.g. unit tests)
        return False
    return bool(instance.get_runs(filters=RunsFilter(job_name=SCF_JOB, statuses=_ACTIVE_STATUSES), limit=1))


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")


@sensor(
    job_name=SCF_JOB,
    minimum_interval_seconds=120,
    description="Polls Airtable for SCF data changes. Triggers ETL when any "
    "table gains or loses records, or when existing records are edited.",
)
def airtable_scf_sensor(context: SensorEvaluationContext):
    api_key = os.getenv("AIRTABLE_API_KEY")
    if not api_key:
        yield SkipReason("AIRTABLE_API_KEY not set.")
        return

    # Wait for an active run to finish. The cursor is left as is, so changes made meanwhile are
    # still detected on the first tick after the run ends.
    if _scf_run_active(context):
        yield SkipReason("An SCF pipeline run is already queued or running.")
        return

    # Load previous fingerprint from cursor
    raw_cursor = context.cursor or "{}"
    try:
        state = json.loads(raw_cursor)
    except json.JSONDecodeError:
        state = {}

    last_fingerprint = state.get("fingerprint")
    last_checked_at = state.get("checked_at")

    # Captured before fetching, so edits made while this tick runs are caught
    # by the next tick rather than falling between the two.
    checked_at = _utc_now_iso()

    try:
        current_fingerprint = _get_table_fingerprint(api_key)
        # Cursors written before edit detection existed have no checked_at;
        # start tracking edits from this tick.
        modified_count = (
            _count_modified_since(api_key, last_checked_at) if last_checked_at else 0
        )
    except Exception as e:
        context.log.error(f"Failed to fetch SCF table state: {e}")
        yield SkipReason(f"Airtable fetch failed: {e}")
        return

    # Persist only after a successful fetch, so a failed tick doesn't
    # advance checked_at past edits it never saw.
    state["fingerprint"] = current_fingerprint
    state["checked_at"] = checked_at
    context.update_cursor(json.dumps(state))

    if last_fingerprint is None:
        # First run — record baseline, don't trigger
        context.log.info(
            f"First run — baseline fingerprint recorded: {current_fingerprint[:8]}…"
        )
        yield SkipReason("First run — baseline recorded. Will trigger on next change.")
        return

    if current_fingerprint != last_fingerprint:
        context.log.info(
            f"SCF records added/removed ({last_fingerprint[:8]}… → {current_fingerprint[:8]}…). "
            "Triggering SCF pipeline."
        )
        yield RunRequest(run_key=f"scf-poll-{current_fingerprint[:12]}")
    elif modified_count:
        context.log.info(
            f"{modified_count} SCF record(s) edited since {last_checked_at}. "
            "Triggering SCF pipeline."
        )
        # Unique per tick: repeated edits to the same records must re-run.
        yield RunRequest(run_key=f"scf-edit-{checked_at}")
    else:
        yield SkipReason("No changes detected.")
