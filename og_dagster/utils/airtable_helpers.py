# og_dagster/utils/airtable_helpers.py
"""Reusable Airtable API helpers with pagination, retry, and webhook support."""

import json
import logging
import time
from typing import Any, Dict, List, Optional

import requests

logger = logging.getLogger(__name__)

AIRTABLE_API_BASE = "https://api.airtable.com/v0"
AIRTABLE_META_BASE = "https://api.airtable.com/v0/meta"


def fetch_airtable_table(
    base_id: str,
    table_id: str,
    api_key: str,
    extra_params: Optional[Dict[str, str]] = None,
    max_retries: int = 3,
) -> List[Dict[str, Any]]:
    """
    Fetch all records from an Airtable table with automatic pagination.

    Uses cellFormat=string to return display values matching CSV export format.
    Handles rate limiting (429) with exponential backoff.

    Returns a flat list of dicts (field name -> value) for each record.
    """
    url = f"{AIRTABLE_API_BASE}/{base_id}/{table_id}"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {
        "cellFormat": "string",
        "userLocale": "en",
        "timeZone": "UTC",
    }
    if extra_params:
        params.update(extra_params)

    all_records: List[Dict[str, Any]] = []
    offset = None
    page = 0

    while True:
        page += 1
        if offset:
            params["offset"] = offset
        elif "offset" in params:
            del params["offset"]

        response = _request_with_retry(
            url, headers=headers, params=params, max_retries=max_retries
        )
        data = response.json()

        records = data.get("records", [])
        for record in records:
            row = record.get("fields", {})
            row["_airtable_id"] = record.get("id", "")
            all_records.append(row)

        logger.info(f"Page {page}: fetched {len(records)} records")

        offset = data.get("offset")
        if not offset:
            break

    logger.info(f"Total records fetched: {len(all_records)}")
    return all_records


def _request_with_retry(
    url: str,
    headers: Dict[str, str],
    params: Dict[str, str],
    max_retries: int = 3,
) -> requests.Response:
    """Make an HTTP GET with exponential backoff on 429, 5xx, and timeouts."""
    for attempt in range(max_retries):
        try:
            response = requests.get(url, headers=headers, params=params, timeout=30)
        except requests.exceptions.Timeout:
            wait = 2 ** attempt
            logger.warning(f"Request timed out. Retrying in {wait}s...")
            time.sleep(wait)
            continue

        if response.status_code == 200:
            return response

        if response.status_code == 429:
            wait = 2 ** (attempt + 1)
            logger.warning(f"Rate limited (429). Retrying in {wait}s...")
            time.sleep(wait)
            continue

        if response.status_code >= 500:
            wait = 2 ** attempt
            logger.warning(
                f"Server error ({response.status_code}). Retrying in {wait}s..."
            )
            time.sleep(wait)
            continue

        response.raise_for_status()

    raise RuntimeError(
        f"Airtable API request failed after {max_retries} retries: {url}"
    )


# ============================================================
# Webhook helpers
# ============================================================


def create_webhook(
    base_id: str,
    api_key: str,
) -> Dict[str, Any]:
    """
    Register a webhook on an Airtable base to watch for data changes.
    Returns the webhook payload including id, macSecretBase64, and cursor.
    """
    url = f"{AIRTABLE_META_BASE}/bases/{base_id}/webhooks"
    headers = {
        "Authorization": f"Bearer {api_key}",
        "Content-Type": "application/json",
    }
    payload = {
        "specification": {
            "options": {
                "filters": {
                    "dataTypes": ["tableData"],
                    "recordChangeScope": base_id,
                }
            }
        }
    }

    response = requests.post(url, headers=headers, json=payload, timeout=30)
    response.raise_for_status()
    data = response.json()
    logger.info(f"Webhook created: {data.get('id')}")
    return data


def list_webhooks(base_id: str, api_key: str) -> List[Dict[str, Any]]:
    """List all webhooks registered on a base."""
    url = f"{AIRTABLE_META_BASE}/bases/{base_id}/webhooks"
    headers = {"Authorization": f"Bearer {api_key}"}

    response = requests.get(url, headers=headers, timeout=30)
    response.raise_for_status()
    return response.json().get("webhooks", [])


def poll_webhook(
    base_id: str,
    webhook_id: str,
    cursor: Optional[int],
    api_key: str,
) -> Dict[str, Any]:
    """
    Poll a webhook for new payloads since the given cursor.
    Returns {"cursor": int, "mightHaveMore": bool, "payloads": [...]}.
    """
    url = f"{AIRTABLE_META_BASE}/bases/{base_id}/webhooks/{webhook_id}/payloads"
    headers = {"Authorization": f"Bearer {api_key}"}
    params = {}
    if cursor is not None:
        params["cursor"] = str(cursor)

    response = requests.get(url, headers=headers, params=params, timeout=30)

    if response.status_code == 404:
        logger.warning(f"Webhook {webhook_id} not found (expired or deleted).")
        return {"expired": True}

    response.raise_for_status()
    return response.json()


def refresh_webhook(base_id: str, webhook_id: str, api_key: str) -> bool:
    """Extend a webhook's expiration. Returns True on success."""
    url = (
        f"{AIRTABLE_META_BASE}/bases/{base_id}/webhooks/{webhook_id}/refresh"
    )
    headers = {"Authorization": f"Bearer {api_key}"}

    response = requests.post(url, headers=headers, timeout=30)
    if response.status_code == 200:
        logger.info(f"Webhook {webhook_id} refreshed.")
        return True
    logger.warning(f"Webhook refresh failed: {response.status_code}")
    return False
