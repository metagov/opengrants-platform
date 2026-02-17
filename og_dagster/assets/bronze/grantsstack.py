# og_dagster/assets/bronze/grantsstack.py
"""
Bronze layer extractor for GrantStack (Gitcoin Grants Stack) API.

Endpoint: https://indexer.grantsstack.giveth.io/v1/graphql
API Type: Hasura GraphQL

Extracts:
- Rounds (grant pools/programs)
- Projects (registered projects)
- Applications (project applications to rounds)
- Donations (contributions to projects in rounds)
"""

import os
import time
from typing import List

from dagster import AssetOut, Output, multi_asset
from sqlalchemy import create_engine

from utils.graphql_helpers import (
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PASSWORD,
    POSTGRES_PORT,
    POSTGRES_USER,
    align_columns,
    flatten_dict,
    logger,
    run_query,
    sanitize_for_sql,
)

# ======================
# CONFIGURATION
# ======================
GRANTSSTACK_ENDPOINT = os.getenv(
    "GRANTSSTACK_GRAPHQL_ENDPOINT",
    "https://indexer.grantsstack.giveth.io/v1/graphql"
)

PAGE_SIZE = 100
MAX_PAGES = 5000
REQUEST_DELAY = 0.3
WRITE_BATCH_SIZE = 1000  # rows to accumulate before flushing to DB

# ======================
# DATABASE CONFIG
# ======================
DB_URL = (
    f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}"
    f"@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
)
engine = create_engine(DB_URL)

# ======================
# GRAPHQL QUERIES
# ======================

# Rounds query - fetches ALL fields for complete indexing
ROUNDS_QUERY = """
query GetRounds($limit: Int!, $offset: Int!) {
  rounds(
    limit: $limit
    offset: $offset
    orderBy: {createdAtBlock: DESC}
  ) {
    # Identifiers
    id
    chainId
    projectId

    # Block & time info
    createdAtBlock
    createdByAddress
    updatedAtBlock
    timestamp

    # Funding details
    matchAmount
    matchAmountInUsd
    matchTokenAddress
    fundedAmount
    fundedAmountInUsd
    totalAmountDonatedInUsd
    totalDonationsCount
    uniqueDonorsCount
    totalDistributed

    # Timing
    applicationsStartTime
    applicationsEndTime
    donationsStartTime
    donationsEndTime

    # Strategy
    strategyId
    strategyName
    strategyAddress

    # Metadata (JSON)
    roundMetadata
    roundMetadataCid
    applicationMetadata
    applicationMetadataCid

    # Roles
    adminRole
    managerRole

    # Distribution & Payout
    matchingDistribution
    readyForPayoutTransaction

    # Tags
    tags
  }
}
"""

# Projects query - fetches ALL fields for complete indexing
PROJECTS_QUERY = """
query GetProjects($limit: Int!, $offset: Int!) {
  projects(
    limit: $limit
    offset: $offset
    orderBy: {createdAtBlock: DESC}
  ) {
    # Identifiers
    id
    chainId

    # Block & time info
    createdAtBlock
    createdByAddress
    updatedAtBlock
    timestamp

    # Project details
    name
    nonce
    projectNumber
    projectType
    anchorAddress
    registryAddress

    # Metadata (JSON)
    metadata
    metadataCid
    tags
  }
}
"""

# Applications query - fetches project applications to rounds
APPLICATIONS_QUERY = """
query GetApplications($limit: Int!, $offset: Int!) {
  applications(
    limit: $limit
    offset: $offset
    orderBy: {createdAtBlock: DESC}
  ) {
    id
    chainId
    createdAtBlock
    createdByAddress

    # Relationships
    roundId
    projectId
    anchorAddress

    # Status
    status
    statusSnapshots
    statusUpdatedAtBlock

    # Funding stats
    totalAmountDonatedInUsd
    totalDonationsCount
    uniqueDonorsCount

    # Distribution
    distributionTransaction

    # Metadata
    metadata
    metadataCid
    tags
    timestamp
  }
}
"""

# Donations query - fetches individual contributions
DONATIONS_QUERY = """
query GetDonations($limit: Int!, $offset: Int!) {
  donations(
    limit: $limit
    offset: $offset
    orderBy: {blockNumber: DESC}
  ) {
    id
    chainId
    blockNumber

    # Relationships
    roundId
    applicationId
    projectId

    # Addresses
    donorAddress
    recipientAddress
    tokenAddress

    # Amounts
    amount
    amountInUsd
    amountInRoundMatchToken

    # Transaction
    transactionHash
    timestamp
  }
}
"""

# Payouts query - fetches payout transactions for applications (DAOIP-5 payouts field)
PAYOUTS_QUERY = """
query GetPayouts($limit: Int!, $offset: Int!) {
  applicationsPayouts(
    limit: $limit
    offset: $offset
    orderBy: {timestamp: DESC}
  ) {
    # Identifiers
    id
    chainId

    # Relationships
    applicationId
    roundId

    # Amounts
    amount
    amountInUsd
    amountInRoundMatchToken
    tokenAddress

    # Transaction details
    sender
    transactionHash
    timestamp
  }
}
"""

# Aggregate queries for total counts
AGGREGATES_QUERY = """
query GetAggregates {
  roundsAggregate { aggregate { count } }
  projectsAggregate { aggregate { count } }
  applicationsAggregate { aggregate { count } }
  donationsAggregate { aggregate { count } }
  applicationsPayoutsAggregate { aggregate { count } }
}
"""


# ======================
# BATCH HELPERS
# ======================
def _fetch_and_write(
    query: str,
    entity_name: str,
    table_name: str,
    page_size: int = PAGE_SIZE,
    max_pages: int = MAX_PAGES,
    batch_size: int = WRITE_BATCH_SIZE,
) -> int:
    """
    Fetch an entity with pagination and write to Postgres in batches.

    Instead of accumulating all records in memory, this flushes to the DB
    every `batch_size` rows so that:
    - Memory stays bounded even for millions of rows (donations).
    - If a later batch fails, earlier batches are already persisted.
    - The job can be retried with if_table_exists="append" for resumption.

    Returns the total number of rows written.
    """
    buffer: List[dict] = []
    total_written = 0
    first_write = True
    offset = 0

    for page in range(max_pages):
        try:
            variables = {"limit": page_size, "offset": offset}
            logger.info(f"Fetching {entity_name} - offset={offset}, limit={page_size}")

            response = run_query(query, variables, endpoint=GRANTSSTACK_ENDPOINT)
            items = response.get(entity_name, [])

            if not items:
                logger.info(f"No more {entity_name} records")
                break

            for item in items:
                buffer.append(flatten_dict(item))

            logger.info(
                f"{entity_name} page {page + 1}: {len(items)} records "
                f"(buffer: {len(buffer)}, total written: {total_written})"
            )

            # Flush buffer when it reaches batch_size
            if len(buffer) >= batch_size:
                total_written += _flush_buffer(buffer, table_name, first_write)
                first_write = False
                buffer = []

            if len(items) < page_size:
                break

            offset += page_size
            time.sleep(REQUEST_DELAY)

        except Exception as e:
            logger.error(f"Error fetching {entity_name} at offset {offset}: {e}")
            # Flush whatever we have so far so it isn't lost
            if buffer:
                total_written += _flush_buffer(buffer, table_name, first_write)
                buffer = []
            raise

    # Flush remaining records
    if buffer:
        total_written += _flush_buffer(buffer, table_name, first_write)

    logger.info(f"Total {entity_name} written: {total_written}")
    return total_written


def _flush_buffer(buffer: List[dict], table_name: str, replace: bool) -> int:
    """Convert a list of dicts to a Polars DataFrame and write to Postgres."""
    df = align_columns(buffer)
    df = sanitize_for_sql(df)
    mode = "replace" if replace else "append"
    df.write_database(
        table_name=table_name,
        connection=engine,
        if_table_exists=mode,
    )
    logger.info(f"Flushed {len(df)} rows to {table_name} ({mode})")
    return len(df)


# ======================
# MAIN DAGSTER ASSET
# ======================
@multi_asset(
    outs={
        "bronze__grantsstack_rounds": AssetOut(
            metadata={"description": "Raw GrantStack rounds (grant pools/programs)"},
            tags={"layer": "bronze", "source": "grantsstack", "domain": "grants"},
        ),
        "bronze__grantsstack_projects": AssetOut(
            metadata={"description": "Raw GrantStack projects"},
            tags={"layer": "bronze", "source": "grantsstack", "domain": "grants"},
        ),
        "bronze__grantsstack_applications": AssetOut(
            metadata={"description": "Raw GrantStack applications (projects applied to rounds)"},
            tags={"layer": "bronze", "source": "grantsstack", "domain": "grants"},
        ),
        "bronze__grantsstack_donations": AssetOut(
            metadata={"description": "Raw GrantStack donations (contributions)"},
            tags={"layer": "bronze", "source": "grantsstack", "domain": "grants"},
        ),
        "bronze__grantsstack_payouts": AssetOut(
            metadata={"description": "Raw GrantStack payouts (DAOIP-5 payout transactions)"},
            tags={"layer": "bronze", "source": "grantsstack", "domain": "grants"},
        ),
    },
    compute_kind="graphql",
    group_name="bronze_grantsstack",
)
def fetch_grantsstack_data():
    """
    Fetch all data from GrantStack GraphQL API for complete indexing.

    Uses batched writes so that large datasets (donations) don't
    accumulate entirely in memory. Each entity is fetched, transformed,
    and flushed to Postgres in chunks of WRITE_BATCH_SIZE rows.
    """

    logger.info("Starting GrantStack data extraction...")
    logger.info(f"Endpoint: {GRANTSSTACK_ENDPOINT}")

    # ======================
    # 1. FETCH AGGREGATE COUNTS
    # ======================
    try:
        agg_response = run_query(AGGREGATES_QUERY, {}, endpoint=GRANTSSTACK_ENDPOINT)
        rounds_count = agg_response.get("roundsAggregate", {}).get("aggregate", {}).get("count", "?")
        projects_count = agg_response.get("projectsAggregate", {}).get("aggregate", {}).get("count", "?")
        applications_count = agg_response.get("applicationsAggregate", {}).get("aggregate", {}).get("count", "?")
        donations_count = agg_response.get("donationsAggregate", {}).get("aggregate", {}).get("count", "?")
        payouts_count = agg_response.get("applicationsPayoutsAggregate", {}).get("aggregate", {}).get("count", "?")

        logger.info(f"GrantStack totals - Rounds: {rounds_count}, Projects: {projects_count}, Applications: {applications_count}, Donations: {donations_count}, Payouts: {payouts_count}")
    except Exception as e:
        logger.warning(f"Could not fetch aggregates: {e}")

    # ======================
    # 2. FETCH & WRITE EACH ENTITY IN BATCHES
    # ======================
    entities = [
        (ROUNDS_QUERY, "rounds", "bronze_grantsstack_rounds"),
        (PROJECTS_QUERY, "projects", "bronze_grantsstack_projects"),
        (APPLICATIONS_QUERY, "applications", "bronze_grantsstack_applications"),
        (DONATIONS_QUERY, "donations", "bronze_grantsstack_donations"),
        (PAYOUTS_QUERY, "applicationsPayouts", "bronze_grantsstack_payouts"),
    ]

    counts = {}
    for query, entity_name, table_name in entities:
        logger.info(f"Processing {entity_name}...")
        counts[entity_name] = _fetch_and_write(query, entity_name, table_name)

    # ======================
    # 3. READ BACK FINAL TABLES FOR DAGSTER OUTPUTS
    # ======================
    logger.info("Reading back final tables for Dagster outputs...")

    import polars as pl

    tables = {
        "rounds": "bronze_grantsstack_rounds",
        "projects": "bronze_grantsstack_projects",
        "applications": "bronze_grantsstack_applications",
        "donations": "bronze_grantsstack_donations",
        "payouts": "bronze_grantsstack_payouts",
    }

    dfs = {}
    for key, table_name in tables.items():
        dfs[key] = pl.read_database(
            query=f"SELECT * FROM {table_name}",
            connection=engine,
        )

    # ======================
    # 4. SUMMARY
    # ======================
    logger.info(
        f"GrantStack extraction complete - "
        + ", ".join(f"{k}: {v}" for k, v in counts.items())
    )

    yield Output(dfs["rounds"], "bronze__grantsstack_rounds")
    yield Output(dfs["projects"], "bronze__grantsstack_projects")
    yield Output(dfs["applications"], "bronze__grantsstack_applications")
    yield Output(dfs["donations"], "bronze__grantsstack_donations")
    yield Output(dfs["payouts"], "bronze__grantsstack_payouts")
