# giveth_assets.py
import time
from sqlalchemy import create_engine

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
# MAIN DAGSTER ASSET
# ======================
@multi_asset(
    outs={
        "bronze__giveth_qf_rounds": AssetOut(
            metadata={"description": "Raw Giveth QF Rounds with Stats"},
            tags={"layer": "bronze", "source": "giveth", "domain": "grants"},
        ),
        "bronze__giveth_projects": AssetOut(
            metadata={"description": "Raw Giveth Projects"},
            tags={"layer": "bronze", "source": "giveth", "domain": "grants"},
        ),
    },
)
def fetch_giveth_data():
    """Fetch Giveth QF Rounds Stats and Projects with enforced 10-item pagination limit."""
    logger.info("🚀 Fetching Giveth data...")

    # ------------------------------
    # 1. FIRST GET ALL QF ROUND SLUGS (inactive only)
    # ------------------------------
    qf_rounds_slugs_query = """
    query GetRoundsSlugs {
      qfRounds(activeOnly: false) {
        id
        slug
        isActive
      }
    }
    """
    qf_rounds_slugs_data = run_query(qf_rounds_slugs_query, {})
    qf_rounds_slugs = qf_rounds_slugs_data.get("qfRounds", [])
    
    # Filter only inactive rounds
    inactive_rounds = [r for r in qf_rounds_slugs if not r.get("isActive", True)]
    logger.info(f"📦 Found {len(inactive_rounds)} inactive QF rounds to fetch stats for")

    # ------------------------------
    # 2. FETCH DETAILED STATS FOR EACH ROUND USING QFRoundStats
    # ------------------------------
    qf_round_stats_query = """
    query QFRoundStats($slug: String!) {
      qfRoundStats(slug: $slug) {
        uniqueDonors
        donationsCount
        allDonationsUsdValue
        matchingPool
        qfRound {
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
          displaySize
          bannerFull
          bannerMobile
          hubCardImage
          sponsorsImgs
          isDataAnalysisDone
          clusterMatchingSyncAt
        }
      }
    }
    """

    all_qf_rounds_stats = []
    
    for round_slug in inactive_rounds:
        slug = round_slug["slug"]
        logger.info(f"📊 Fetching stats for round: {slug}")
        
        try:
            stats_data = run_query(qf_round_stats_query, {"slug": slug})
            qf_round_stats = stats_data.get("qfRoundStats", {})
            
            if qf_round_stats:
                # Combine the stats with the round data
                combined_data = {
                    **qf_round_stats,
                    "qfRound": qf_round_stats.get("qfRound", {})
                }
                all_qf_rounds_stats.append(combined_data)
                logger.info(f"✅ Successfully fetched stats for {slug}")
            else:
                logger.warning(f"⚠️ No stats data returned for {slug}")
                
            time.sleep(0.5)  # Small delay between requests
            
        except Exception as e:
            logger.error(f"❌ Failed to fetch stats for {slug}: {e}")
            continue

    # Flatten the nested structure
    qf_rounds_flat = []
    for stats in all_qf_rounds_stats:
        flat_stats = flatten_dict(stats)
        qf_rounds_flat.append(flat_stats)
    
    qf_rounds_df = align_columns(qf_rounds_flat)
    logger.info(f"📦 QF Rounds with stats fetched: {len(qf_rounds_df)}")

    # ------------------------------
    # 3. PROJECTS BY ROUND (10-item enforced pagination) - using IDs from stats
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

    # Use round IDs from the stats we fetched
    for round_stats in all_qf_rounds_stats:
        qf_round_data = round_stats.get("qfRound", {})
        rid = int(qf_round_data.get("id", 0))
        if rid == 0:
            continue
            
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
    # 4. CREATE DATAFRAMES
    # ------------------------------
    projects_df = align_columns(all_projects)
    logger.info(f"📦 Total projects fetched across rounds: {len(projects_df)}")

    # ------------------------------
    # 5. SANITIZE & LOAD TO DB
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