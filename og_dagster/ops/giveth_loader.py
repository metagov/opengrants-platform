import json
import os
import time
from datetime import datetime
from pathlib import Path
from typing import Any

import numpy as np
import polars as pl
import requests
import yaml
from sqlalchemy import create_engine
from dagster import AssetOut, Output, get_dagster_logger, multi_asset

logger = get_dagster_logger()

# ============================================================
# DATABASE CONFIG
# ============================================================
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_DB = os.getenv("POSTGRES_DB", "opengrants")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")

DB_URL = (
    f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@"
    f"{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)
engine = create_engine(DB_URL)

ENDPOINT = "https://mainnet.serve.giveth.io/graphql"
SCHEMA_MAP_DIR = Path("configs/schema_maps")
SCHEMA_MAP_DIR.mkdir(parents=True, exist_ok=True)


# ============================================================
# HELPERS
# ============================================================
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


def flatten_dict(d: dict[str, Any], parent_key: str = "", sep: str = "_") -> dict[str, Any]:
    items = []
    for k, v in d.items():
        new_key = f"{parent_key}{sep}{k}" if parent_key else k
        if isinstance(v, dict):
            items.extend(flatten_dict(v, new_key, sep=sep).items())
        else:
            items.append((new_key, v))
    return dict(items)


def align_columns(data: list[dict]) -> pl.DataFrame:
    """Safely aligns dicts into a Polars DataFrame with consistent column types."""
    if not data:
        return pl.DataFrame()

    all_keys = sorted(set().union(*(row.keys() for row in data)))
    aligned = [{key: row.get(key, None) for key in all_keys} for row in data]

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

    return pl.DataFrame(safe_aligned, infer_schema_length=None)


# ============================================================
# SCHEMA AUTO-MAP GENERATION
# ============================================================
def _save_schema_yaml(df: pl.DataFrame, name: str):
    """Compare schema to last version and write a draft YAML if changed."""
    schema_snapshot = {col: str(df[col].dtype) for col in df.columns}

    # Find last schema version
    existing = sorted(SCHEMA_MAP_DIR.glob(f"daoip5_{name}_v*.yaml"))
    last_schema = {}
    if existing:
        with open(existing[-1], "r") as f:
            try:
                last_schema = yaml.safe_load(f) or {}
            except Exception:
                last_schema = {}

    old_cols = set(last_schema.get("detected_columns", {}).keys() if last_schema else [])
    new_cols = set(schema_snapshot.keys())

    added = list(new_cols - old_cols)
    removed = list(old_cols - new_cols)

    if added or removed:
        version = f"v{len(existing) + 1}"
        draft_path = SCHEMA_MAP_DIR / f"daoip5_{name}_{version}_draft.yaml"

        schema_yaml = {
            "version": version,
            "source": "giveth",
            "generated_at": datetime.utcnow().isoformat(),
            "detected_columns": schema_snapshot,
            "daoip5_mapping": {
                "project": {},
                "grant_pool": {},
                "application": {},
                "unmapped": added,
            },
            "changes": {"added": added, "removed": removed},
        }

        with open(draft_path, "w") as f:
            yaml.safe_dump(schema_yaml, f, sort_keys=False)

        logger.info(
            f"🆕 Schema change detected for {name}: added={added}, removed={removed}. "
            f"Draft written to {draft_path}. Review before promotion."
        )
    else:
        logger.info(f"✅ No schema changes detected for {name}.")


# ============================================================
# MAIN DAGSTER ASSET
# ============================================================
@multi_asset(
    outs={
        "bronze__giveth_qf_rounds": AssetOut(
            metadata={"description": "Raw Giveth QF Rounds"},
            tags={"layer": "bronze", "source": "giveth", "domain": "grants"},
        ),
        "bronze__giveth_projects": AssetOut(
            metadata={"description": "Raw Giveth Projects"},
            tags={"layer": "bronze", "source": "giveth", "domain": "grants"},
        ),
    },
)
def fetch_giveth_data():
    """Fetch Giveth QF Rounds and Projects with 10-item enforced pagination."""
    logger.info("🚀 Fetching Giveth data...")

    # ====================================================
    # 1. QF ROUNDS
    # ====================================================
    qf_rounds_query = """
    query GetRounds($activeOnly: Boolean!) {
      qfRounds(activeOnly: $activeOnly) {
          id
          name
          title
          description
          slug
          isActive
          allocatedFund
          allocatedFundUSD
          allocatedFundUSDPreferred
          allocatedTokenSymbol
          allocatedTokenChainId
          maximumReward
          minimumPassportScore
          minMBDScore
          minimumValidUsdValue
          eligibleNetworks
          beginDate
          endDate
          qfStrategy
          bannerBgImage
          sponsorsImgs
          isDataAnalysisDone
          clusterMatchingSyncAt 
      }
    }
    """
    qf_rounds_data = run_query(qf_rounds_query, {"activeOnly": False})
    qf_rounds = qf_rounds_data.get("qfRounds", [])
    qf_rounds_flat = [flatten_dict(r) for r in qf_rounds]
    qf_rounds_df = align_columns(qf_rounds_flat)
    logger.info(f"📦 Rounds fetched: {len(qf_rounds_df)}")

    # ====================================================
    # 2. PROJECTS BY ROUND
    # ====================================================
    projects_query = """
    query GetProjects($qfRoundId: Int!, $skip: Int!, $take: Int!) {
      allProjects(qfRoundId: $qfRoundId, skip: $skip, take: $take, orderBy: {
        field: CreationDate,
        direction: DESC
      }) {
        projects {
          id
          title
          slug
          description
          website
          creationDate
          updatedAt
          walletAddress
          verified
          reviewStatus
          totalDonations
          totalTraceDonations
          totalReactions
          listed
          isGivbackEligible
          campaigns { id title slug isActive createdAt }
        }
      }
    }
    """

    all_projects = []
    PAGE_SIZE = 10
    MAX_PAGES = 2000

    for round_ in qf_rounds:
        rid = int(round_["id"])
        skip = 0
        total_for_round = 0
        seen_ids = set()
        logger.info(f"🔍 Fetching projects for round {rid}...")

        for page in range(MAX_PAGES):
            vars = {"qfRoundId": rid, "skip": skip, "take": PAGE_SIZE}
            result = run_query(projects_query, vars)
            projects = result.get("allProjects", {}).get("projects", [])
            fetched = len(projects)
            if not projects:
                break
            first_id = projects[0].get("id")
            if first_id in seen_ids:
                break
            seen_ids.add(first_id)
            all_projects.extend([flatten_dict(p) for p in projects])
            total_for_round += fetched
            logger.info(f"Fetched {fetched} projects (skip={skip}).")
            if fetched < PAGE_SIZE:
                break
            skip += PAGE_SIZE
            time.sleep(1)

        logger.info(f"📊 Round {rid} — total projects fetched: {total_for_round}")

    projects_df = align_columns(all_projects)
    logger.info(f"📦 Total projects fetched across rounds: {len(projects_df)}")

    # ====================================================
    # 3. SANITIZE + LOAD
    # ====================================================
    qf_rounds_df = sanitize_for_sql(qf_rounds_df)
    projects_df = sanitize_for_sql(projects_df)

    qf_rounds_df = qf_rounds_df.with_columns(pl.lit(datetime.utcnow()).alias("_loaded_at"))
    projects_df = projects_df.with_columns(pl.lit(datetime.utcnow()).alias("_loaded_at"))

    logger.info("🧱 Writing Bronze layer tables to Postgres...")
    qf_rounds_df.write_database(
        table_name="bronze_giveth_qf_rounds",
        connection=engine,
        mode="append"
    )
    projects_df.write_database(
        table_name="bronze_giveth_projects",
        connection=engine,
        mode="append"
    )

    # ====================================================
    # 4. SCHEMA TRACKING
    # ====================================================
    _save_schema_yaml(qf_rounds_df, "giveth_qf_rounds")
    _save_schema_yaml(projects_df, "giveth_projects")

    logger.info(f"✅ Rows written -> bronze_giveth_qf_rounds: {len(qf_rounds_df)}")
    logger.info(f"✅ Rows written -> bronze_giveth_projects: {len(projects_df)}")
    logger.info("🏁 Giveth Bronze layer load complete.")

    yield Output(qf_rounds_df, "bronze__giveth_qf_rounds")
    yield Output(projects_df, "bronze__giveth_projects")
