# maci_grant_assets.py
import time
from sqlalchemy import create_engine
import polars as pl

from dagster import AssetOut, Output, multi_asset
from utils.graphql_helpers import (
    logger,
    POSTGRES_USER,
    POSTGRES_PASSWORD,
    POSTGRES_DB,
    POSTGRES_HOST,
    POSTGRES_PORT,
    run_query,
    flatten_dict,
    align_columns,
    sanitize_for_sql,
)

# ======================
# DATABASE CONFIG
# ======================
DB_URL = f"postgresql+psycopg2://{POSTGRES_USER}:{POSTGRES_PASSWORD}@{POSTGRES_HOST}:{POSTGRES_PORT}/{POSTGRES_DB}"
engine = create_engine(DB_URL)

# ======================
# GRAPHQL ENDPOINT
# ======================
import os
MACI_GRAPHQL_ENDPOINT = os.getenv("MACI_GRAPHQL_ENDPOINT")
if not MACI_GRAPHQL_ENDPOINT:
    raise ValueError("MACI_GRAPHQL_ENDPOINT environment variable not set!")

# ======================
# CONFIGURATION
# ======================
PAGE_SIZE = 100
MAX_PAGES = 100  # Increase to get more data
REQUEST_DELAY = 0.2

# ======================
# FIXED GRAPHQL QUERIES
# ======================

# Query 1: Get ALL Claims (SIMPLIFIED - remove complex filters)
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
    tally {
      id
      poll {
        id
      }
    }
  }
}
"""

# Query 2: Get ALL Recipients
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

# Query 3: Get Registries and System Data
REGISTRIES_QUERY = """
query GetRegistries {
  registries(first: 100, orderBy: id) {
    id
    metadataUrl
    poll {
      id
      pollId
      initTime
      createdAt
      updatedAt
      owner
      duration
      treeDepth
      maxMessages
      maxVoteOption
      messageProcessor
      mode
      stateRoot
      numSignups
      numMessages
      numSrQueueOps
      messageRoot
      maci {
        id
        stateTreeDepth
        numSignUps
        numPoll
        latestPoll
        updatedAt
      }
      tally {
        id
      }
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

# Query 4: Get Other Supporting Data
SUPPORTING_QUERY = """
query GetSupportingData {
  requests(first: 1000, orderBy: index) {
    id
    requestType
    index
    recipientIndex
    status
    recipient {
      id
      metadataUrl
      payout
      index
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
  
  tallyResults(first: 1000, orderBy: id) {
    id
    result
    tally {
      id
    }
  }
  
  users(first: 1000, orderBy: createdAt, orderDirection: desc) {
    id
    createdAt
  }
  
  accounts(first: 1000, orderBy: createdAt, orderDirection: desc) {
    id
    voiceCreditBalance
    createdAt
    owner {
      id
    }
  }
}
"""

# ======================
# IMPROVED PAGINATION FUNCTION
# ======================
def get_paginated_data(query_template, base_variables, entity_name):
    """Execute paginated GraphQL query for large datasets"""
    all_results = []
    skip = 0
    total_fetched = 0
    
    for page in range(MAX_PAGES):
        try:
            variables = base_variables.copy()
            variables['skip'] = skip
            variables['first'] = PAGE_SIZE
            
            logger.info(f"🔍 Fetching {entity_name} - skip: {skip}, first: {PAGE_SIZE}")
            result = run_query(query_template, variables)
            items = result.get(entity_name, [])
            
            if not items:
                logger.info(f"✅ No more {entity_name} to fetch")
                break
                
            all_results.extend(items)
            total_fetched += len(items)
            logger.info(f"📄 {entity_name} - Page {page + 1}: {len(items)} items (Total: {total_fetched})")
            
            # Stop if we got fewer items than requested (last page)
            if len(items) < PAGE_SIZE:
                logger.info(f"✅ Reached last page for {entity_name}")
                break
                
            skip += PAGE_SIZE
            time.sleep(REQUEST_DELAY)
            
        except Exception as e:
            logger.error(f"❌ Error fetching {entity_name} page {page}: {e}")
            break
            
    logger.info(f"🎯 Total {entity_name} fetched: {total_fetched}")
    return all_results

# ======================
# IMPROVED JOIN FUNCTION
# ======================
def join_claims_with_recipients(claims_df, recipients_df):
    """Join claims with recipients data"""
    if claims_df.is_empty():
        logger.warning("⚠️ No claims data to join")
        return pl.DataFrame()
    
    if recipients_df.is_empty():
        logger.warning("⚠️ No recipients data to join")
        return claims_df
    
    logger.info(f"🔗 Joining {len(claims_df)} claims with {len(recipients_df)} recipients")
    
    # Debug: Check the columns
    logger.info(f"📋 Claims columns: {claims_df.columns}")
    logger.info(f"📋 Recipients columns: {recipients_df.columns}")
    
    # Extract recipient ID from claims - handle nested structure
    if 'poll' in claims_df.columns:
        join_key_claims = "poll"
    else:
        # Try to find the recipient ID column
        recipient_cols = [col for col in claims_df.columns if 'recipient' in col.lower() and 'id' in col.lower()]
        if recipient_cols:
            join_key_claims = recipient_cols[0]
            logger.info(f"🔍 Using {join_key_claims} as join key for claims")
        else:
            logger.error("❌ No recipient ID column found in claims data")
            return claims_df
    
    # Prepare the dataframes for joining
    claims_prepared = claims_df.with_columns(
        pl.col(join_key_claims).alias("join_key")
    )
    
    recipients_prepared = recipients_df.with_columns(
        pl.col("id").alias("join_key")
    )
    
    # Perform the join
    try:
        joined_df = claims_prepared.join(
            recipients_prepared,
            on="join_key",
            how="left"
        )
        logger.info(f"✅ Successfully joined {len(joined_df)} records")
        return joined_df
    except Exception as e:
        logger.error(f"❌ Error joining data: {e}")
        return claims_df

# ======================
# DEBUG FUNCTION
# ======================
def debug_data_structure(data, entity_name):
    """Debug function to inspect data structure"""
    if not data:
        logger.warning(f"⚠️ No {entity_name} data to debug")
        return
    
    sample = data[0] if data else {}
    logger.info(f"🔍 {entity_name} sample structure: {list(sample.keys())}")
    
    # Check for nested recipient data in claims
    if entity_name == "claims" and sample.get('recipient'):
        logger.info(f"🔍 {entity_name} recipient structure: {list(sample['recipient'].keys())}")

# ======================
# MAIN DAGSTER ASSET
# ======================
@multi_asset(
    outs={
        "bronze_privote_claims": AssetOut(
            metadata={"description": "Raw Privote Claims (Funding Distributions)"},
            tags={"layer": "bronze", "source": "privote", "domain": "grants"},
        ),
        "bronze_privote_recipients": AssetOut(
            metadata={"description": "Raw Privote Recipients (Projects)"},
            tags={"layer": "bronze", "source": "privote", "domain": "grants"},
        ),
        "bronze_privote_claims_enriched": AssetOut(
            metadata={"description": "Privote Claims enriched with Recipient data"},
            tags={"layer": "bronze", "source": "privote", "domain": "grants"},
        ),
        "bronze_privote_registries": AssetOut(
            metadata={"description": "Raw Privote Registries (Grant Pools)"},
            tags={"layer": "bronze", "source": "privote", "domain": "grants"},
        ),
        "bronze_privote_requests": AssetOut(
            metadata={"description": "Raw Privote Application Requests"},
            tags={"layer": "bronze", "source": "privote", "domain": "grants"},
        ),
        "bronze_privote_tally_results": AssetOut(
            metadata={"description": "Raw Privote Tally Results (Vote Counts)"},
            tags={"layer": "bronze", "source": "privote", "domain": "grants"},
        ),
        "bronze_privote_deposits": AssetOut(
            metadata={"description": "Raw Privote Funding Deposits"},
            tags={"layer": "bronze", "source": "privote", "domain": "grants"},
        ),
        "bronze_privote_users": AssetOut(
            metadata={"description": "Raw Privote Users & Accounts"},
            tags={"layer": "bronze", "source": "privote", "domain": "grants"},
        ),
        "bronze_privote_system": AssetOut(
            metadata={"description": "Raw Privote System Overview"},
            tags={"layer": "bronze", "source": "privote", "domain": "grants"},
        ),
    },
)
def fetch_privote_data():
    """Fetch comprehensive Privote grant data with proper joins"""
    
    logger.info(f"🚀 Using GraphQL endpoint: {MACI_GRAPHQL_ENDPOINT}")
    
    # ------------------------------
    # 1. GET ALL CLAIMS FIRST (Core funding data)
    # ------------------------------
    logger.info("💰 Step 1: Fetching ALL claims...")
    all_claims = get_paginated_data(CLAIMS_QUERY, {}, "claims")
    
    # Debug claims structure
    debug_data_structure(all_claims, "claims")
    
    claims_df = align_columns([flatten_dict(c) for c in all_claims])
    logger.info(f"✅ Fetched {len(claims_df)} claims")
    
    # ------------------------------
    # 2. GET ALL RECIPIENTS (Projects)
    # ------------------------------
    logger.info("🏢 Step 2: Fetching ALL recipients...")
    all_recipients = get_paginated_data(RECIPIENTS_QUERY, {}, "recipients")
    
    # Debug recipients structure
    debug_data_structure(all_recipients, "recipients")
    
    recipients_df = align_columns([flatten_dict(r) for r in all_recipients])
    logger.info(f"✅ Fetched {len(recipients_df)} recipients")
    
    # ------------------------------
    # 3. JOIN CLAIMS WITH RECIPIENTS
    # ------------------------------
    logger.info("🔗 Step 3: Joining claims with recipient data...")
    claims_enriched_df = join_claims_with_recipients(claims_df, recipients_df)
    
    # ------------------------------
    # 4. GET REGISTRIES AND SYSTEM DATA
    # ------------------------------
    logger.info("🏛️ Step 4: Fetching registries and system data...")
    registries_data = run_query(REGISTRIES_QUERY, {})
    registries = registries_data.get("registries", [])
    macis = registries_data.get("macis", [])
    
    registries_df = align_columns([flatten_dict(r) for r in registries])
    macis_df = align_columns([flatten_dict(m) for m in macis])
    
    # ------------------------------
    # 5. GET SUPPORTING DATA
    # ------------------------------
    logger.info("📊 Step 5: Fetching supporting data...")
    supporting_data = run_query(SUPPORTING_QUERY, {})
    
    requests = supporting_data.get("requests", [])
    deposits = supporting_data.get("deposits", [])
    tally_results = supporting_data.get("tallyResults", [])
    users = supporting_data.get("users", [])
    accounts = supporting_data.get("accounts", [])
    
    requests_df = align_columns([flatten_dict(r) for r in requests])
    deposits_df = align_columns([flatten_dict(d) for d in deposits])
    tally_results_df = align_columns([flatten_dict(tr) for tr in tally_results])
    users_df = align_columns([flatten_dict(u) for u in users])
    
    # ------------------------------
    # 6. SANITIZE & LOAD TO BRONZE LAYER
    # ------------------------------
    logger.info("💾 Writing Bronze layer tables to Postgres...")
    
    tables_to_load = [
        (claims_df, "bronze_privote_claims"),
        (recipients_df, "bronze_privote_recipients"),
        (claims_enriched_df, "bronze_privote_claims_enriched"),
        (registries_df, "bronze_privote_registries"),
        (requests_df, "bronze_privote_requests"),
        (tally_results_df, "bronze_privote_tally_results"),
        (deposits_df, "bronze_privote_deposits"),
        (users_df, "bronze_privote_users"),
        (macis_df, "bronze_privote_system"),
    ]
    
    for df, table_name in tables_to_load:
        if not df.is_empty():
            df_sanitized = sanitize_for_sql(df)
            df_sanitized.write_database(
                table_name=table_name,
                connection=engine,
                if_table_exists="replace",
            )
            logger.info(f"✅ {table_name}: {len(df_sanitized)} rows")
        else:
            logger.warning(f"⚠️ No data for {table_name}, creating empty table")
            empty_df = pl.DataFrame()
            empty_df.write_database(
                table_name=table_name,
                connection=engine,
                if_table_exists="replace",
            )

    # ------------------------------
    # 7. LOG DATA SUMMARY
    # ------------------------------
    logger.info("📊 Data Extraction Summary:")
    logger.info(f"   • Claims: {len(claims_df)}")
    logger.info(f"   • Recipients: {len(recipients_df)}")
    logger.info(f"   • Enriched Claims: {len(claims_enriched_df)}")
    logger.info(f"   • Registries: {len(registries_df)}")
    logger.info(f"   • Requests: {len(requests_df)}")
    logger.info(f"   • Tally Results: {len(tally_results_df)}")
    logger.info(f"   • Deposits: {len(deposits_df)}")
    logger.info(f"   • Users: {len(users_df)}")
    logger.info(f"   • MACI Systems: {len(macis_df)}")

    logger.info("🏁 Comprehensive Privote data extraction complete.")

    yield Output(claims_df, "bronze_privote_claims")
    yield Output(recipients_df, "bronze_privote_recipients")
    yield Output(claims_enriched_df, "bronze_privote_claims_enriched")
    yield Output(registries_df, "bronze_privote_registries")
    yield Output(requests_df, "bronze_privote_requests")
    yield Output(tally_results_df, "bronze_privote_tally_results")
    yield Output(deposits_df, "bronze_privote_deposits")
    yield Output(users_df, "bronze_privote_users")
    yield Output(macis_df, "bronze_privote_system")