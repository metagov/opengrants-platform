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
# PAGINATION HELPER
# ======================
def fetch_paginated(
    query: str,
    entity_name: str,
    page_size: int = PAGE_SIZE,
    max_pages: int = MAX_PAGES,
) -> List[dict]:
    """
    Fetch all records for an entity using Hasura-style pagination.

    Args:
        query: GraphQL query with $limit and $offset variables
        entity_name: Name of the entity in the response (e.g., "rounds")
        page_size: Number of records per page
        max_pages: Maximum number of pages to fetch (safety limit)

    Returns:
        List of all fetched records (flattened)
    """
    all_results = []
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

            # Flatten each record
            for item in items:
                all_results.append(flatten_dict(item))

            logger.info(f"{entity_name} page {page + 1}: {len(items)} records (total: {len(all_results)})")

            if len(items) < page_size:
                # Last page
                break

            offset += page_size
            time.sleep(REQUEST_DELAY)

        except Exception as e:
            logger.error(f"Error fetching {entity_name} at offset {offset}: {e}")
            break

    logger.info(f"Total {entity_name} fetched: {len(all_results)}")
    return all_results


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

    Extracts:
    - Rounds: Grant pools/programs with funding details
    - Projects: Registered projects on the platform
    - Applications: Project applications to specific rounds
    - Donations: Individual contributions to projects
    - Payouts: Payout transactions for applications (DAOIP-5 compliant)
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
    # 2. FETCH ROUNDS
    # ======================
    logger.info("Fetching rounds...")
    rounds_data = fetch_paginated(ROUNDS_QUERY, "rounds")

    # ======================
    # 3. FETCH PROJECTS
    # ======================
    logger.info("Fetching projects...")
    projects_data = fetch_paginated(PROJECTS_QUERY, "projects")

    # ======================
    # 4. FETCH APPLICATIONS
    # ======================
    logger.info("Fetching applications...")
    applications_data = fetch_paginated(APPLICATIONS_QUERY, "applications")

    # ======================
    # 5. FETCH DONATIONS
    # ======================
    logger.info("Fetching donations...")
    # Donations can be very large, so we may want to limit
    donations_data = fetch_paginated(
        DONATIONS_QUERY,
        "donations",
        page_size=PAGE_SIZE,
        max_pages=MAX_PAGES,
    )

    # ======================
    # 6. FETCH PAYOUTS (DAOIP-5 compliant)
    # ======================
    logger.info("Fetching payouts...")
    payouts_data = fetch_paginated(PAYOUTS_QUERY, "applicationsPayouts")

    # ======================
    # 7. CREATE DATAFRAMES
    # ======================
    logger.info("Creating DataFrames...")

    rounds_df = align_columns(rounds_data) if rounds_data else align_columns([])
    projects_df = align_columns(projects_data) if projects_data else align_columns([])
    applications_df = align_columns(applications_data) if applications_data else align_columns([])
    donations_df = align_columns(donations_data) if donations_data else align_columns([])
    payouts_df = align_columns(payouts_data) if payouts_data else align_columns([])

    # ======================
    # 8. SANITIZE FOR SQL
    # ======================
    logger.info("Sanitizing DataFrames for SQL compatibility...")

    rounds_df = sanitize_for_sql(rounds_df)
    projects_df = sanitize_for_sql(projects_df)
    applications_df = sanitize_for_sql(applications_df)
    donations_df = sanitize_for_sql(donations_df)
    payouts_df = sanitize_for_sql(payouts_df)

    # ======================
    # 9. WRITE TO DATABASE
    # ======================
    logger.info("Writing bronze tables to Postgres...")

    rounds_df.write_database(
        table_name="bronze_grantsstack_rounds",
        connection=engine,
        if_table_exists="replace",
    )
    logger.info(f"Written {len(rounds_df)} rounds")

    projects_df.write_database(
        table_name="bronze_grantsstack_projects",
        connection=engine,
        if_table_exists="replace",
    )
    logger.info(f"Written {len(projects_df)} projects")

    applications_df.write_database(
        table_name="bronze_grantsstack_applications",
        connection=engine,
        if_table_exists="replace",
    )
    logger.info(f"Written {len(applications_df)} applications")

    donations_df.write_database(
        table_name="bronze_grantsstack_donations",
        connection=engine,
        if_table_exists="replace",
    )
    logger.info(f"Written {len(donations_df)} donations")

    payouts_df.write_database(
        table_name="bronze_grantsstack_payouts",
        connection=engine,
        if_table_exists="replace",
    )
    logger.info(f"Written {len(payouts_df)} payouts")

    # ======================
    # 10. SUMMARY
    # ======================
    logger.info(
        f"GrantStack extraction complete - "
        f"Rounds: {len(rounds_df)}, "
        f"Projects: {len(projects_df)}, "
        f"Applications: {len(applications_df)}, "
        f"Donations: {len(donations_df)}, "
        f"Payouts: {len(payouts_df)}"
    )

    yield Output(rounds_df, "bronze__grantsstack_rounds")
    yield Output(projects_df, "bronze__grantsstack_projects")
    yield Output(applications_df, "bronze__grantsstack_applications")
    yield Output(donations_df, "bronze__grantsstack_donations")
    yield Output(payouts_df, "bronze__grantsstack_payouts")
