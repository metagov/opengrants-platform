import json
import os
import time
from typing import Any

import numpy as np
import polars as pl
import requests
from sqlalchemy import create_engine

from dagster import AssetOut, Output, get_dagster_logger, multi_asset

logger = get_dagster_logger()

# ======================
# DATABASE CONFIG
# ======================
POSTGRES_USER = os.getenv("POSTGRES_USER", "postgres")
POSTGRES_PASSWORD = os.getenv("POSTGRES_PASSWORD", "postgres")
POSTGRES_DB = os.getenv("POSTGRES_DB", "opengrants")
POSTGRES_HOST = os.getenv("POSTGRES_HOST", "postgres")
POSTGRES_PORT = os.getenv("POSTGRES_PORT", "5432")

DB_URL = f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
engine = create_engine(DB_URL)

ENDPOINT = "https://mainnet.serve.giveth.io/graphql"


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



# ======================
# MAIN DAGSTER ASSET
# ======================
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
    """Fetch Giveth QF Rounds and Projects with enforced 10-item pagination limit."""
    logger.info("🚀 Fetching Giveth data...")

    # ------------------------------
    # 1. QF ROUNDS
    # ------------------------------
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

    # ------------------------------
    # 2. PROJECTS BY ROUND (10-item enforced pagination)
    # ------------------------------
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
          slugHistory
          description
          descriptionSummary
          traceCampaignId
          givingBlocksId
          changeId
          website
          youtube
          creationDate
          updatedAt
          latestUpdateCreationDate
          organization { id name website }
          coOrdinates
          image
          impactLocation
          categories {
            id
          }
          qfRounds {
            id
            title
          }
          balance
          stripeAccountId
          walletAddress
          verified
          verificationStatus
          isImported
          giveBacks
          donations {
            id
          }
          qualityScore
          contacts {
            url
          }
          reactions{
            id
          }
          addresses {
            id
          }
          socialMedia {
            id
          }
          anchorContracts {
            id
          }
          status{
            id
            name
          }
          adminUserId
          statusHistory {
            id
          }
          projectVerificationForm {
            id
          }
          featuredUpdate {
            id
          }
          verificationFormStatus
          socialProfiles { id name link socialNetwork isVerified }
          projectEstimatedMatchingView { projectId qfRoundId }
          totalDonations
          totalTraceDonations
          totalReactions
          totalProjectUpdates
          sumDonationValueUsdForActiveQfRound
          countUniqueDonorsForActiveQfRound
          countUniqueDonors
          listed
          isGivbackEligible
          reviewStatus
          projectUrl
          prevStatusId
          adminJsBaseUrl
          campaigns {
              id
              slug
              title
              type
              isActive
              isNew
              isFeatured
              description
              hashtags
              relatedProjectsSlugs
              landingLink
              updatedAt
              createdAt
          }
          estimatedMatching {
            projectDonationsSqrtRootSum
            allProjectsSum
            matchingPool
            matching
          }
        }
      }
    }
    """

    all_projects = []
    PAGE_SIZE = 10  # enforced Giveth API cap
    MAX_PAGES = 2000  # safety cap (20k projects max per round)

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
                logger.info(
                    f"✅ Completed round {rid}: total {total_for_round} projects."
                )
                break

            first_id = projects[0].get("id") if projects else None
            if first_id in seen_ids:
                logger.warning(
                    f"⚠️ Pagination stuck for round {rid} at skip={skip}. Breaking."
                )
                break
            seen_ids.add(first_id)

            all_projects.extend([flatten_dict(p) for p in projects])
            total_for_round += fetched
            logger.info(f"Fetched {fetched} projects from round {rid} (skip={skip}).")

            # Stop if fewer than PAGE_SIZE (last page)
            if fetched < PAGE_SIZE:
                logger.info(f"✅ Finished fetching all pages for round {rid}.")
                break

            skip += PAGE_SIZE
            time.sleep(1)  # small delay to avoid rate-limit

        logger.info(f"📊 Round {rid} — total projects fetched: {total_for_round}")

    # ------------------------------
    # 3. CREATE DATAFRAMES
    # ------------------------------
    projects_df = align_columns(all_projects)
    logger.info(f"📦 Total projects fetched across rounds: {len(projects_df)}")

    # ------------------------------
    # 4. SANITIZE & LOAD TO DB
    # ------------------------------
    qf_rounds_df = sanitize_for_sql(qf_rounds_df)
    projects_df = sanitize_for_sql(projects_df)

    logger.info("🧱 Writing Bronze layer tables to Postgres...")
    qf_rounds_df.write_database(
        table_name="bronze_giveth_qf_rounds",
        connection=engine,
        if_table_exists="replace",
    )
    projects_df.write_database(
        table_name="bronze_giveth_projects",
        connection=engine,
        if_table_exists="replace",
    )

    logger.info(f"✅ Rows written -> bronze_giveth_qf_rounds: {len(qf_rounds_df)}")
    logger.info(f"✅ Rows written -> bronze_giveth_projects: {len(projects_df)}")
    logger.info("🏁 Giveth Bronze layer load complete.")

    yield Output(qf_rounds_df, "bronze__giveth_qf_rounds")
    yield Output(projects_df, "bronze__giveth_projects")
