# og_dagster/sensors/scf_sensor.py
"""
Dagster sensor that polls an Airtable webhook for SCF data changes.

Auto-registers a webhook if none exists or if the current one has expired.
When changes are detected, triggers the full SCF ETL pipeline
(bronze -> silver -> gold).
"""

import json
import os

from dagster import (
    RunRequest,
    SensorEvaluationContext,
    SkipReason,
    sensor,
)
from configs.scf_airtable import SCF_BASE_ID
from utils.airtable_helpers import (
    create_webhook,
    list_webhooks,
    poll_webhook,
    refresh_webhook,
)


def _get_or_create_webhook(api_key: str, cursor_state: dict) -> dict:
    """
    Ensure a valid webhook exists. Returns updated cursor state with
    webhook_id and cursor position.
    """
    webhook_id = cursor_state.get("webhook_id")

    # If we have a stored webhook, try to refresh it
    if webhook_id:
        refreshed = refresh_webhook(SCF_BASE_ID, webhook_id, api_key)
        if refreshed:
            return cursor_state

    # No valid webhook — check if one already exists on the base
    existing = list_webhooks(SCF_BASE_ID, api_key)
    for wh in existing:
        cursor_state["webhook_id"] = wh["id"]
        # Reset cursor to start fresh with this webhook
        cursor_state["cursor"] = None
        return cursor_state

    # Create a new webhook
    result = create_webhook(SCF_BASE_ID, api_key)
    cursor_state["webhook_id"] = result["id"]
    cursor_state["cursor"] = result.get("cursor")
    return cursor_state


@sensor(
    job_name="etl_scf_full_job",
    minimum_interval_seconds=120,
    description="Polls Airtable webhook for SCF data changes. "
    "Auto-registers webhook if needed.",
)
def airtable_scf_sensor(context: SensorEvaluationContext):
    api_key = os.getenv("AIRTABLE_API_KEY")
    if not api_key:
        yield SkipReason("AIRTABLE_API_KEY not set.")
        return

    # Load cursor state
    raw_cursor = context.cursor or "{}"
    try:
        state = json.loads(raw_cursor)
    except json.JSONDecodeError:
        state = {}

    # Ensure we have a valid webhook
    try:
        state = _get_or_create_webhook(api_key, state)
    except Exception as e:
        context.log.error(f"Failed to get/create webhook: {e}")
        yield SkipReason(f"Webhook setup failed: {e}")
        return

    webhook_id = state.get("webhook_id")
    if not webhook_id:
        yield SkipReason("No webhook ID available.")
        return

    # Poll for changes, draining all pages if mightHaveMore is set
    all_payloads = []
    max_poll_pages = 10  # Guard against infinite loops
    for _ in range(max_poll_pages):
        try:
            result = poll_webhook(
                base_id=SCF_BASE_ID,
                webhook_id=webhook_id,
                cursor=state.get("cursor"),
                api_key=api_key,
            )
        except Exception as e:
            context.log.error(f"Webhook poll failed: {e}")
            yield SkipReason(f"Poll failed: {e}")
            return

        # Webhook expired — clear and re-register next tick
        if result.get("expired"):
            context.log.info("Webhook expired. Will re-register on next tick.")
            state.pop("webhook_id", None)
            state.pop("cursor", None)
            context.update_cursor(json.dumps(state))
            yield SkipReason("Webhook expired. Re-registering on next tick.")
            return

        all_payloads.extend(result.get("payloads", []))
        new_cursor = result.get("cursor")

        # Always advance cursor to avoid re-processing
        if new_cursor is not None:
            state["cursor"] = new_cursor

        if not result.get("mightHaveMore", False):
            break

    context.update_cursor(json.dumps(state))

    if all_payloads:
        context.log.info(
            f"Detected {len(all_payloads)} change(s). Triggering SCF pipeline."
        )
        yield RunRequest(run_key=f"scf-webhook-{state.get('cursor')}")
    else:
        yield SkipReason("No changes detected.")
