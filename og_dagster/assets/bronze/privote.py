# maci_grant_assets.py
import json
import os
import time
from typing import Any, Dict, List, Optional

import polars as pl
import requests
from dagster import AssetOut, Output, multi_asset
from sqlalchemy import text
from utils.db import get_pg_engine
from utils.graphql_helpers import (
    align_columns,
    flatten_dict,
    logger,
    run_query,
    sanitize_for_sql,
)

MACI_GRAPHQL_ENDPOINT = os.getenv("MACI_GRAPHQL_ENDPOINT")

# ======================
# CONFIGURATION
# ======================
PAGE_SIZE = 100
MAX_PAGES = 200
REQUEST_DELAY = 0.2
METADATA_FETCH_TIMEOUT = 8.0

# ======================
# GRAPHQL QUERIES
# ======================
RECIPIENTS_QUERY = """
query GetRecipientsPaginated($skip: Int!, $first: Int!) {
  recipients(
    skip: $skip
    first: $first
    orderBy: index
  ) {
    id
    metadataUrl
    payout
    index
    deleted
    initialized
    registry {
      id
      metadataUrl
      poll {
        id
        pollId
      }
    }
  }
}
"""

CLAIMS_QUERY = """
query GetClaimsPaginated($skip: Int!, $first: Int!) {
  claims(
    skip: $skip
    first: $first
    orderBy: amount
    orderDirection: desc
  ) {
    id
    amount
  }
}
"""

REGISTRIES_QUERY = """
query GetRegistries {
  registries(first: 100, orderBy: id) {
    id
    metadataUrl
    poll {
      id
      pollId
    }
  }
  
  macis(first: 10, orderBy: updatedAt, orderDirection: desc) {
    id
    stateTreeDepth
    numSignUps
    numPoll
    latestPoll
    updatedAt
  }
}
"""

SUPPORTING_QUERY = """
query GetSupportingData {
  users(first: 1000, orderBy: createdAt, orderDirection: desc) {
    id
    createdAt
  }
  
  requests(first: 1000, orderBy: index) {
    id
    requestType
    index
    recipientIndex
    status
    recipient {
      id
      metadataUrl
    }
    registry {
      id
    }
  }
  
  deposits(first: 1000, orderBy: amount, orderDirection: desc) {
    id
    amount
    tally {
      id
      poll {
        id
        pollId
      }
    }
  }
  
  tallyResults(first: 200, orderBy: id) {
    id
    result
    tally {
      id
    }
  }
}
"""


# ======================
# PAGINATION
# ======================
def get_paginated_data(
    query_template: str, base_variables: dict, entity_name: str
) -> List[dict]:
    """Fetch paginated data from GraphQL endpoint."""
    all_results = []
    skip = 0
    total_fetched = 0

    for page in range(MAX_PAGES):
        try:
            variables = dict(base_variables)
            variables["skip"] = skip
            variables["first"] = PAGE_SIZE

            logger.info(f"🔍 Fetching {entity_name} - skip={skip} first={PAGE_SIZE}")
            res = run_query(query_template, variables, endpoint=MACI_GRAPHQL_ENDPOINT)
            items = res.get(entity_name, [])

            if not items:
                logger.info(f"✅ No more {entity_name}")
                break

            all_results.extend(items)
            total_fetched += len(items)
            logger.info(
                f"📄 {entity_name} page {page+1}: {len(items)} (total {total_fetched})"
            )

            if len(items) < PAGE_SIZE:
                break

            skip += PAGE_SIZE
            time.sleep(REQUEST_DELAY)

        except Exception as e:
            logger.error(f"❌ Error fetching {entity_name} page {page}: {e}")
            break

    logger.info(f"🎯 Fetched total {len(all_results)} {entity_name}")
    return all_results


# ======================
# METADATA FETCH / FLATTEN
# ======================
def fetch_json(url: Optional[str]) -> Optional[dict]:
    """Fetch JSON from URL with timeout."""
    if not url:
        return None

    try:
        r = requests.get(url, timeout=METADATA_FETCH_TIMEOUT)
        if r.status_code != 200:
            logger.warning(f"⚠️ Metadata fetch failed ({r.status_code}) for {url}")
            return None
        return r.json()
    except Exception as e:
        logger.warning(f"⚠️ Metadata request error for {url}: {e}")
        return None


def flatten_metadata_json(md: dict) -> Dict[str, Any]:
    """Take a metadata JSON object and flatten basic fields; keep full JSON as string."""
    if not md:
        return {}

    out = {}
    # Common top-level fields only
    simple_fields = [
        "name",
        "shortBio",
        "bio",
        "profileImageUrl",
        "bannerImageUrl",
        "websiteUrl",
        "github",
        "twitter",
        "contributionDescription",
        "impactDescription",
        "submittedAt",
        "creator",
        "payoutAddress",
        "payout",
    ]

    for field in simple_fields:
        out[f"metadata_{field}"] = md.get(field)

    # Store complex fields as JSON strings
    complex_fields = ["impactCategory", "contributionLinks", "fundingSources"]
    for field in complex_fields:
        value = md.get(field)
        out[f"metadata_{field}_json"] = json.dumps(value) if value is not None else None

    # Raw JSON
    out["metadata_raw_json"] = json.dumps(md)

    return out


def parse_and_store_metadata_urls(recipients_df: pl.DataFrame) -> pl.DataFrame:
    """Parse metadata URLs, fetch JSON remotely, flatten and create metadata table."""
    if recipients_df.is_empty():
        logger.warning("⚠️ No recipients to parse metadata urls from")
        return pl.DataFrame()

    records = []
    logger.info(f"🔍 Parsing metadata URLs for {len(recipients_df)} recipients")

    for row in recipients_df.iter_rows(named=True):
        rec = {
            "recipient_id": str(row.get("id")),
            "recipient_index": try_int(row.get("index")),
            "metadata_url": (
                str(row.get("metadataUrl")) if row.get("metadataUrl") else None
            ),
            "payout": str(row.get("payout")) if row.get("payout") else None,
            "deleted": bool(row.get("deleted")),
            "initialized": bool(row.get("initialized")),
            "registry_id": None,
            "registry_metadata_url": None,
            "registry_poll_id": None,
            "registry_poll_pollId": None,
        }

        # Extract registry info
        registry = row.get("registry")
        if isinstance(registry, dict):
            rec["registry_id"] = str(registry.get("id")) if registry.get("id") else None
            rec["registry_metadata_url"] = (
                str(registry.get("metadataUrl"))
                if registry.get("metadataUrl")
                else None
            )
            poll = registry.get("poll")
            if isinstance(poll, dict):
                rec["registry_poll_id"] = (
                    str(poll.get("id")) if poll.get("id") else None
                )
                rec["registry_poll_pollId"] = (
                    str(poll.get("pollId")) if poll.get("pollId") else None
                )

        # Fetch and flatten metadata
        md = fetch_json(rec["metadata_url"])
        flat = flatten_metadata_json(md) if md else {}
        rec.update(flat)
        records.append(rec)

    # Convert all values to strings to ensure schema consistency
    string_records = []
    for record in records:
        string_record = {}
        for key, value in record.items():
            if value is None:
                string_record[key] = None
            elif isinstance(value, (dict, list)):
                string_record[key] = json.dumps(value)
            else:
                string_record[key] = str(value)
        string_records.append(string_record)

    metadata_df = pl.DataFrame(string_records)

    # Add derived flags
    metadata_df = metadata_df.with_columns(
        [
            pl.col("metadata_url").is_not_null().alias("has_metadata_url"),
            pl.col("registry_metadata_url")
            .is_not_null()
            .alias("has_registry_metadata"),
            pl.col("payout").is_not_null().alias("has_payout"),
            (pl.col("deleted") == "False").alias("is_not_deleted"),
            (pl.col("initialized") == "True").alias("is_initialized"),
            ((pl.col("deleted") == "False") & (pl.col("initialized") == "True")).alias(
                "is_approved_applicant"
            ),
        ]
    )

    logger.info(f"✅ Parsed metadata for {metadata_df.height} recipients")
    return metadata_df


# ======================
# UTILS
# ======================
def try_int(v):
    """Safely convert value to integer."""
    try:
        if v is None:
            return None
        return int(v)
    except Exception:
        try:
            return int(float(v))
        except Exception:
            return None


def create_privote_schema(engine):
    """Create the privote schema if it doesn't exist."""
    try:
        with engine.connect() as conn:
            conn.execute(text("CREATE SCHEMA IF NOT EXISTS privote"))
            conn.commit()
        logger.info("✅ Created privote schema")
    except Exception as e:
        logger.error(f"❌ Error creating privote schema: {e}")


# ======================
# DATABASE WRITING
# ======================
def safe_write_to_database(df: pl.DataFrame, table_name: str, engine):
    """Safely write DataFrame to database with proper handling for large numbers."""
    if df.is_empty():
        logger.warning(f"⚠️ Table {table_name} empty — skipping")
        return

    try:
        # Convert large numbers to strings to avoid '_pli128' error
        df_sanitized = df.clone()

        for col in df_sanitized.columns:
            if df_sanitized[col].dtype in [pl.Int64, pl.UInt64]:
                df_sanitized = df_sanitized.with_columns(
                    [
                        pl.when(pl.col(col).abs() > 2**63)
                        .then(pl.col(col).cast(pl.Utf8))
                        .otherwise(pl.col(col))
                        .alias(col)
                    ]
                )

        df_sanitized = sanitize_for_sql(df_sanitized)
        df_sanitized.write_database(
            table_name=table_name, connection=engine, if_table_exists="replace"
        )
        logger.info(f"✅ Wrote {table_name} ({df_sanitized.height} rows)")

    except Exception as e:
        logger.error(f"❌ Error writing {table_name}: {e}")
        # Fallback
        try:
            logger.info("🔄 Attempting fallback write method...")
            df_string = df.with_columns(
                [pl.col(col).cast(pl.Utf8) for col in df.columns]
            )
            df_string.write_database(
                table_name=table_name, connection=engine, if_table_exists="replace"
            )
            logger.info(f"✅ Fallback write successful for {table_name}")
        except Exception as e2:
            logger.error(f"❌ Fallback also failed for {table_name}: {e2}")


# ======================
# MAIN DAGSTER ASSET
# ======================
@multi_asset(
    group_name="bronze",
    outs={
        "bronze_privote_recipients": AssetOut(
            metadata={"description": "Raw Privote Recipients (Projects)"}
        ),
        "bronze_privote_claims": AssetOut(
            metadata={"description": "Raw Privote Claims (Tally Results)"}
        ),
        "bronze_privote_registries": AssetOut(
            metadata={"description": "Raw Privote Registries (Grant Pools)"}
        ),
        "bronze_privote_metadata_urls": AssetOut(
            metadata={"description": "Parsed Metadata URLs & flattened metadata"}
        ),
        "bronze_privote_users": AssetOut(metadata={"description": "Privote Users"}),
        "bronze_privote_requests": AssetOut(
            metadata={"description": "Privote Application Requests"}
        ),
        "bronze_privote_tally_results": AssetOut(
            metadata={"description": "Privote Tally Results (Vote Counts)"}
        ),
        "bronze_privote_deposits": AssetOut(
            metadata={"description": "Privote Funding Deposits"}
        ),
        "bronze_privote_system": AssetOut(
            metadata={"description": "MACI System Overview"}
        ),
    }
)
def fetch_privote_data():
    engine = get_pg_engine()
    if not MACI_GRAPHQL_ENDPOINT:
        raise ValueError("MACI_GRAPHQL_ENDPOINT environment variable not set!")

    # Create privote schema first
    create_privote_schema(engine)

    # 1) Recipients
    logger.info("🏢 Step 1: Fetching recipients...")
    all_recipients = get_paginated_data(RECIPIENTS_QUERY, {}, "recipients")
    recipients_df = align_columns([flatten_dict(r) for r in all_recipients])
    logger.info(f"✅ Recipients fetched: {recipients_df.height}")

    # 2) Parse & store metadata URLs
    logger.info("🔗 Step 2: Parsing metadata URLs...")
    metadata_urls_df = parse_and_store_metadata_urls(recipients_df)

    # 3) Claims (tally results t_i)
    logger.info("💰 Step 3: Fetching claims (tally results)...")
    all_claims = get_paginated_data(CLAIMS_QUERY, {}, "claims")
    claims_df = align_columns([flatten_dict(c) for c in all_claims])
    logger.info(f"✅ Claims fetched: {claims_df.height}")

    # 4) Registries + macis
    logger.info("🏛️ Step 4: Fetching registries + macis...")
    regs_data = run_query(REGISTRIES_QUERY, {}, endpoint=MACI_GRAPHQL_ENDPOINT)
    registries = regs_data.get("registries", [])
    macis = regs_data.get("macis", [])
    registries_df = align_columns([flatten_dict(r) for r in registries])
    macis_df = align_columns([flatten_dict(m) for m in macis])

    # 5) Supporting data
    logger.info("📋 Step 5: Fetching supporting data...")
    supporting = run_query(SUPPORTING_QUERY, {}, endpoint=MACI_GRAPHQL_ENDPOINT)
    users = supporting.get("users", [])
    requests = supporting.get("requests", [])
    deposits = supporting.get("deposits", [])
    tally_results = supporting.get("tallyResults", [])

    users_df = align_columns([flatten_dict(u) for u in users])
    requests_df = align_columns([flatten_dict(r) for r in requests])
    deposits_df = align_columns([flatten_dict(d) for d in deposits])
    tally_results_df = align_columns([flatten_dict(tr) for tr in tally_results])

    logger.info(
        f"✅ Supporting data - users: {users_df.height}, requests: {requests_df.height}, deposits: {deposits_df.height}, tallyResults: {tally_results_df.height}"
    )

    # 6) Write all tables to Postgres
    logger.info("💾 Step 6: Writing Bronze tables to Postgres...")
    tables_to_load = [
        (recipients_df, "privote.bronze_privote_recipients"),
        (claims_df, "privote.bronze_privote_claims"),
        (registries_df, "privote.bronze_privote_registries"),
        (metadata_urls_df, "privote.bronze_privote_metadata_urls"),
        (users_df, "privote.bronze_privote_users"),
        (requests_df, "privote.bronze_privote_requests"),
        (tally_results_df, "privote.bronze_privote_tally_results"),
        (deposits_df, "privote.bronze_privote_deposits"),
        (macis_df, "privote.bronze_privote_system"),
    ]

    for df, table in tables_to_load:
        if df is None or df.is_empty():
            logger.warning(f"⚠️ Table {table} empty — skipping")
            continue
        safe_write_to_database(df, table, engine)

    # 7) Log summary
    logger.info("📊 Extraction Summary:")
    logger.info(f"  • Recipients: {recipients_df.height}")
    logger.info(f"  • Metadata URLs parsed: {metadata_urls_df.height}")
    logger.info(f"  • Claims: {claims_df.height}")
    logger.info(f"  • Registries: {registries_df.height}")
    logger.info(f"  • Users: {users_df.height}")
    logger.info(f"  • Requests: {requests_df.height}")
    logger.info(f"  • Deposits: {deposits_df.height}")
    logger.info(f"  • Tally Results: {tally_results_df.height}")
    logger.info(f"  • MACI Systems: {macis_df.height}")

    # 8) Yield outputs
    yield Output(recipients_df, "bronze_privote_recipients")
    yield Output(claims_df, "bronze_privote_claims")
    yield Output(registries_df, "bronze_privote_registries")
    yield Output(metadata_urls_df, "bronze_privote_metadata_urls")
    yield Output(users_df, "bronze_privote_users")
    yield Output(requests_df, "bronze_privote_requests")
    yield Output(tally_results_df, "bronze_privote_tally_results")
    yield Output(deposits_df, "bronze_privote_deposits")
    yield Output(macis_df, "bronze_privote_system")
