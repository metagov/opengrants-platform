import requests
import polars as pl
import time
from typing import Any
from dagster import multi_asset, AssetOut, Output, get_dagster_logger
from sqlalchemy import create_engine
import os
import numpy as np
import json

logger = get_dagster_logger()

# PostgreSQL connection
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_DB = os.getenv("POSTGRES_DB", "opengrants")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")

DB_URL = f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
engine = create_engine(DB_URL)

ENDPOINT = "https://mainnet.serve.giveth.io/graphql"

def _to_json_safe(x):
    """Handle any nested structure so it can be JSON serialized safely."""
    # Handle None
    if x is None:
        return None
    # Handle numpy arrays
    if isinstance(x, np.ndarray):
        return json.dumps(x.tolist())
    # Handle Polars Series (common in pl.List)
    if isinstance(x, pl.Series):
        return json.dumps(x.to_list())
    # Handle Python list/dict/tuple
    if isinstance(x, (list, dict, tuple)):
        return json.dumps(x)
    # Fallback to str()
    try:
        json.dumps(x)  # test serializability
        return x
    except Exception:
        return str(x)

def sanitize_for_sql(df: pl.DataFrame) -> pl.DataFrame:
    """Convert list/array/Series/dict values to JSON-safe strings for SQL insertion."""
    for col in df.columns:
        s = df[col]
        # Check for List or Object dtypes
        if s.dtype in (pl.List, pl.Object):
            df = df.with_columns(
                s.map_elements(_to_json_safe).alias(col)
            )
    return df


def run_query(query, variables, retries=3, delay=5):
    for attempt in range(retries):
        try:
            response = requests.post(ENDPOINT, json={"query": query, "variables": variables})
            response.raise_for_status()
            json_data = response.json()
            if "data" not in json_data or json_data["data"] is None:
                raise ValueError(f"No 'data' field in response: {json_data}")
            return json_data["data"]
        except (requests.exceptions.RequestException, ValueError) as e:
            if attempt < retries - 1:
                logger.warning(f"[Retry {attempt+1}] Giveth API failed: {e}. Retrying in {delay} seconds...")
                time.sleep(delay)
                delay *= 2
            else:
                raise


def flatten_dict(d: dict[str, Any], parent_key: str = '', sep: str = '_') -> dict[str, Any]:
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def align_columns(data: list[dict]) -> pl.DataFrame:
    if not data:
        return pl.DataFrame()
    all_keys = sorted(set().union(*(row.keys() for row in data)))
    aligned_data = [{key: row.get(key, None) for key in all_keys} for row in data]
    return pl.DataFrame(aligned_data, schema=all_keys)


@multi_asset(
    outs={
        "bronze__giveth_qf_rounds": AssetOut(),
        "bronze__giveth_projects": AssetOut(),
    },
)
def fetch_giveth_data():
    """Fetch QF Rounds and Project data from Giveth GraphQL API and load into Bronze Layer (Postgres)."""

    logger.info("🚀 Fetching Giveth data...")

    # --- Query 1: QF Rounds ---
    qf_rounds_query = """
    query GetRounds($activeOnly: Boolean!) {
      qfRounds(activeOnly: $activeOnly) {
          id name title description slug isActive
          allocatedFund allocatedFundUSD allocatedFundUSDPreferred
          allocatedTokenSymbol allocatedTokenChainId
          maximumReward minimumPassportScore minMBDScore minimumValidUsdValue
          eligibleNetworks beginDate endDate qfStrategy
          bannerBgImage sponsorsImgs isDataAnalysisDone clusterMatchingSyncAt
      }
    }
    """
    qf_rounds_result = run_query(qf_rounds_query, {"activeOnly": False})
    qf_rounds = qf_rounds_result.get("qfRounds", [])
    qf_rounds_flat = [flatten_dict(r) for r in qf_rounds]
    qf_rounds_df = align_columns(qf_rounds_flat)
    logger.info(f"Fetched {len(qf_rounds_df)} QF rounds.")

    # --- Query 2: Projects by Round ---
    projects_query = """
    query GetProjects($qfRoundId: Int!, $skip: Int!, $take: Int!) {
      allProjects(qfRoundId: $qfRoundId, skip: $skip, take: $take, orderBy: {
        field: CreationDate, direction: DESC
      }) {
        projects {
          id title slug description creationDate updatedAt verified
          walletAddress balance totalDonations listed reviewStatus
          qfRounds { id title }
        }
      }
    }
    """

    all_projects = []
    for round_ in qf_rounds:
        rid = int(round_["id"])
        skip = 0
        while True:
            result = run_query(projects_query, {"qfRoundId": rid, "skip": skip, "take": 50})
            projects = result.get("allProjects", {}).get("projects", [])
            if not projects:
                break
            all_projects.extend([flatten_dict(p) for p in projects])
            skip += 50
            logger.info(f"Fetched {len(projects)} projects from round {rid} (skip={skip}).")

    projects_df = align_columns(all_projects)
    logger.info(f"Fetched {len(projects_df)} projects total.")

    # --- Write to Bronze Layer ---
    logger.info("🧱 Writing Bronze layer tables to Postgres...")
    qf_rounds_df = sanitize_for_sql(qf_rounds_df)
    projects_df = sanitize_for_sql(projects_df)

    logger.info("🧱 Writing Bronze layer tables to Postgres...")
    qf_rounds_df.write_database(
        table_name="bronze_giveth_qf_rounds", connection=engine, if_table_exists="replace"
    )
    projects_df.write_database(
        table_name="bronze_giveth_projects", connection=engine, if_table_exists="replace"
    )

    logger.info("✅ Data loaded into bronze_giveth_qf_rounds and bronze_giveth_projects")

    yield Output(qf_rounds_df, "bronze__giveth_qf_rounds")
    yield Output(projects_df, "bronze__giveth_projects")
    logger.info("✅ Giveth data fetch and load complete.")