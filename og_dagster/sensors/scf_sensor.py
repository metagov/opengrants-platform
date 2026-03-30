# og_dagster/sensors/scf_sensor.py
"""
Dagster sensor that polls Airtable for SCF data changes.

Fetches record counts from all 3 SCF tables every 2 minutes.
When the total count changes (new submissions, rounds, or projects),
triggers the full SCF ETL pipeline (bronze -> silver -> gold).

Note: Airtable webhooks require creator-level base access which this
token does not have. Polling record counts is reliable and sufficient.
"""

import hashlib
import json
import os

from dagster import (
    RunRequest,
    SensorEvaluationContext,
    SkipReason,
    sensor,
)
from configs.scf_airtable import SCF_BASE_ID, SCF_TABLES
from utils.airtable_helpers import fetch_airtable_table


def _get_table_fingerprint(api_key: str) -> str:
    """
    Fetch record counts from all SCF tables and return a fingerprint hash.
    Uses record IDs only (no field data) to minimize API usage.
    """
    id_sets = []
    for table_name, table_id in sorted(SCF_TABLES.items()):
        records = fetch_airtable_table(
            base_id=SCF_BASE_ID,
            table_id=table_id,
            api_key=api_key,
            # Fetch only a lightweight sentinel field — we only need IDs
            extra_params={"fields[]": "Name", "pageSize": "100"},
        )
        # Collect record IDs for this table
        ids = sorted(r.get("_airtable_id", "") for r in records)
        id_sets.append(f"{table_name}:{len(ids)}:{','.join(ids[:10])}")

    fingerprint = hashlib.md5("|".join(id_sets).encode()).hexdigest()
    return fingerprint


@sensor(
    job_name="etl_scf_full_job",
    minimum_interval_seconds=120,
    description="Polls Airtable record counts for SCF data changes. "
    "Triggers ETL when any table gains or loses records.",
)
def airtable_scf_sensor(context: SensorEvaluationContext):
    api_key = os.getenv("AIRTABLE_API_KEY")
    if not api_key:
        yield SkipReason("AIRTABLE_API_KEY not set.")
        return

    # Load previous fingerprint from cursor
    raw_cursor = context.cursor or "{}"
    try:
        state = json.loads(raw_cursor)
    except json.JSONDecodeError:
        state = {}

    last_fingerprint = state.get("fingerprint")

    try:
        current_fingerprint = _get_table_fingerprint(api_key)
    except Exception as e:
        context.log.error(f"Failed to fetch SCF table fingerprint: {e}")
        yield SkipReason(f"Airtable fetch failed: {e}")
        return

    # Always persist the latest fingerprint
    state["fingerprint"] = current_fingerprint
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
            f"SCF data changed ({last_fingerprint[:8]}… → {current_fingerprint[:8]}…). "
            "Triggering SCF pipeline."
        )
        yield RunRequest(run_key=f"scf-poll-{current_fingerprint[:12]}")
    else:
        yield SkipReason("No changes detected.")
