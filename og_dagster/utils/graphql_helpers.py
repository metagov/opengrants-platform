# giveth_helpers.py
import json
import os
import time
from typing import Any

import numpy as np
import polars as pl
import requests
from dagster import get_dagster_logger

logger = get_dagster_logger()

# ======================
# DATABASE CONFIG
# ======================
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_DB = os.getenv("POSTGRES_DB", "opengrants")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")

# ======================
# DEFAULT ENDPOINTS
# ======================
GIVETH_ENDPOINT = os.getenv(
    "GIVETH_GRAPHQL_ENDPOINT", "https://mainnet.serve.giveth.io/graphql"
)


# ======================
# HELPERS
# ======================
def _to_json_safe(x):
    if x is None:
        return None
    if isinstance(x, np.ndarray):
        return json.dumps(x.tolist())
    if isinstance(x, pl.Series):
        return json.dumps(x.to_list())
    if isinstance(x, (list, dict, tuple)):
        return json.dumps(x)
    try:
        json.dumps(x)
        return x
    except Exception:
        return str(x)


def sanitize_for_sql(df: pl.DataFrame) -> pl.DataFrame:
    for col in df.columns:
        s = df[col]
        if s.dtype in (pl.List, pl.Object):
            df = df.with_columns(s.map_elements(_to_json_safe).alias(col))
    return df


# graphql_helpers.py
def run_query(query, variables=None, endpoint=GIVETH_ENDPOINT, retries=3, delay=5):
    """
    Run GraphQL query against specified endpoint
    """
    for attempt in range(retries):
        try:
            logger.info(f"🔍 Making GraphQL request to: {endpoint}")
            logger.info(f"🔍 Query: {query[:200]}...")  # Log first 200 chars

            headers = {
                "Content-Type": "application/json",
                "Accept": "application/json",
            }

            payload = {"query": query, "variables": variables or {}}

            logger.info(f"🔍 Payload keys: {list(payload.keys())}")

            resp = requests.post(endpoint, json=payload, headers=headers, timeout=30)

            # Log the raw response
            logger.info(f"🔍 Response status: {resp.status_code}")
            logger.info(f"🔍 Response headers: {dict(resp.headers)}")
            logger.info(f"🔍 Response text (first 500 chars): {resp.text[:500]}")

            resp.raise_for_status()

            data = resp.json()

            if "errors" in data:
                logger.error(f"❌ GraphQL Errors: {data['errors']}")

            if "data" not in data or data["data"] is None:
                error_msg = f"No 'data' field in response from {endpoint}: {data}"
                logger.error(f"❌ {error_msg}")
                raise ValueError(error_msg)

            return data["data"]

        except requests.exceptions.RequestException as e:
            logger.error(f"❌ Request failed: {e}")
            if attempt < retries - 1:
                logger.warning(f"[Retry {attempt+1}] Retrying in {delay}s...")
                time.sleep(delay)
                delay *= 2
            else:
                raise
        except Exception as e:
            logger.error(f"❌ Unexpected error: {e}")
            raise


def flatten_dict(
    d: dict[str, Any], parent_key: str = '', sep: str = '_'
) -> dict[str, Any]:
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def align_columns(data: list[dict]) -> pl.DataFrame:
    """Safely aligns all dicts into a Polars DataFrame with consistent column types."""
    if not data:
        return pl.DataFrame()

    all_keys = sorted(set().union(*(row.keys() for row in data)))
    aligned = [{key: row.get(key, None) for key in all_keys} for row in data]

    # Ensure consistent string conversion to avoid schema inference errors
    safe_aligned = []
    for row in aligned:
        safe_row = {}
        for k, v in row.items():
            if isinstance(v, (dict, list)):
                safe_row[k] = json.dumps(v)
            elif isinstance(v, (np.ndarray, pl.Series)):
                safe_row[k] = json.dumps(v.tolist())
            elif v is None:
                safe_row[k] = None
            else:
                if isinstance(v, int) and (v > 2**63 - 1 or v < -(2**63)):
                    # Blockchain uint256/bytes32 values overflow Polars Int64
                    safe_row[k] = str(v)
                elif not isinstance(v, (int, float, bool, type(None))):
                    safe_row[k] = str(v)
                else:
                    safe_row[k] = v
        safe_aligned.append(safe_row)

    # Build dataframe with schema inference disabled
    return pl.DataFrame(safe_aligned, infer_schema_length=None)
