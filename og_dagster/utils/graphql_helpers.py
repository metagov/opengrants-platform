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

ENDPOINT = os.getenv("MACI_GRAPHQL_ENDPOINT") or "https://mainnet.serve.giveth.io/graphql"


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


def run_query(query, variables, retries=3, delay=5):
    for attempt in range(retries):
        try:
            resp = requests.post(
                ENDPOINT, json={"query": query, "variables": variables}
            )
            resp.raise_for_status()
            data = resp.json()
            if "data" not in data or data["data"] is None:
                raise ValueError(f"No 'data' field in response: {data}")
            return data["data"]
        except Exception as e:
            if attempt < retries - 1:
                logger.warning(
                    f"[Retry {attempt+1}] Giveth API error: {e}. Retrying in {delay}s..."
                )
                time.sleep(delay)
                delay *= 2
            else:
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
                # Always cast to str for mixed-type fields
                if not isinstance(v, (int, float, bool, type(None))):
                    safe_row[k] = str(v)
                else:
                    safe_row[k] = v
        safe_aligned.append(safe_row)

    # Build dataframe with schema inference disabled
    return pl.DataFrame(safe_aligned, infer_schema_length=None)