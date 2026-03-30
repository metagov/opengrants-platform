# giveth_assets.py
import os
import time
from datetime import datetime, timezone

from dagster import AssetOut, Output, multi_asset

from utils.db import get_pg_engine, upsert_platform_metadata
from utils.graphql_helpers import (
    align_columns,
    flatten_dict,
    logger,
    run_query,
    sanitize_for_sql,
)

GIVETH_ENDPOINT = os.getenv(
    "GIVETH_GRAPHQL_ENDPOINT", "https://mainnet.serve.giveth.io/graphql"
)


def _parse_iso_dt(value: str | None) -> datetime | None:
    """Best-effort ISO-8601 datetime parser that tolerates Z suffix."""
    if not value:
        return None
    try:
        v = value.strip()
        if v.endswith("Z"):
            v = v[:-1] + "+00:00"
        return datetime.fromisoformat(v)
    except Exception:
        return None


# ======================
# MAIN DAGSTER ASSET
# ======================
@multi_asset(
    group_name="bronze",
    outs={
        "bronze__giveth_qf_rounds": AssetOut(
            metadata={"description": "Raw Giveth Inactive Rounds (ENDED) with Stats + History"},
            tags={"layer": "bronze", "source": "giveth", "domain": "grants"},
        ),
        "bronze__giveth_projects": AssetOut(
            metadata={"description": "Raw Giveth Projects for Inactive Rounds"},
            tags={"layer": "bronze", "source": "giveth", "domain": "grants"},
        ),
    },
)
def fetch_giveth_data():
    """
    Fetch inactive (ENDED) Giveth QF Rounds + Projects.

    NOTE:
    - Giveth no longer exposes `qfArchivedRounds`.
    - We use `qfRounds(activeOnly: false)` and derive inactivity from:
        * isActive == false, OR
        * endDate < now (fallback if isActive is null/missing).
    - For each inactive round we also fetch:
        * qfRoundStats(slug)
        * getQfRoundHistory(qfRoundId)
      and merge them into a single bronze row per round.
    """
    engine = get_pg_engine()

    logger.info("🚀 Fetching QF rounds (including inactive)...")

    # =============================
    # 1. GET ALL ROUNDS VIA qfRounds
    # =============================
    qf_rounds_query = """
    query GetAllRounds {
      qfRounds(activeOnly: false) {
        id
        slug
        name
        title
        description
        beginDate
        endDate
        allocatedFund
        allocatedFundUSD
        allocatedTokenSymbol
        eligibleNetworks
        isActive
        isDataAnalysisDone
        bannerBgImage
        bannerFull
        bannerMobile
      }
    }
    """

    try:
        round_data = run_query(qf_rounds_query, {}, endpoint=GIVETH_ENDPOINT)
        all_rounds = round_data.get("qfRounds", []) or []
        logger.info(f"📦 Found {len(all_rounds)} total QF rounds (all states)")
    except Exception as e:
        logger.error(f"❌ Error fetching qfRounds: {e}")
        # Fallback: introspect Query root to help debug schema issues
        test_query = """
        query IntrospectQueryRoot {
          __type(name: "Query") {
            name
            fields { name }
          }
        }
        """
        try:
            test_result = run_query(test_query, {}, endpoint=GIVETH_ENDPOINT)
            logger.info(f"Available Query fields: {test_result}")
        except Exception as e2:
            logger.error(f"❌ Error introspecting Query type: {e2}")
        raise

    # =============================
    # 2. FILTER INACTIVE / ENDED ROUNDS
    # =============================
    logger.info("🧮 Deriving inactive (ENDED) rounds from qfRounds...")
    inactive_rounds: list[dict] = []

    now_utc = datetime.now(timezone.utc)

    for r in all_rounds:
        is_active = r.get("isActive")
        end_dt = _parse_iso_dt(r.get("endDate"))

        # Primary rule: explicitly inactive
        if is_active is False:
            inactive_rounds.append(r)
            continue

        # Fallback rule: no isActive flag, but endDate is in the past
        if is_active is None and end_dt and end_dt < now_utc:
            inactive_rounds.append(r)

    logger.info(
        f"📦 Inactive / ended rounds derived from qfRounds: {len(inactive_rounds)}"
    )

    if not inactive_rounds:
        logger.warning("⚠️ No inactive rounds detected. Continuing with empty results.")

    # =============================
    # 3. FETCH STATS + HISTORY FOR INACTIVE ROUNDS
    # =============================
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

    qf_round_history_query = """
    query GetRoundHistory($qfRoundId: Int) {
      getQfRoundHistory(qfRoundId: $qfRoundId) {
        id
        qfRoundId
        projectId
        uniqueDonors
        donationsCount
        raisedFundInUsd
        matchingFund
        matchingFundAmount
        matchingFundPriceUsd
        matchingFundCurrency
        distributedFundTxHash
        distributedFundNetwork
        distributedFundTxDate
        estimatedMatching {
          projectDonationsSqrtRootSum
          allProjectsSum
          matchingPool
          matching
        }
      }
    }
    """

    all_rounds_flat: list[dict] = []

    for r in inactive_rounds:
        slug = r.get("slug")
        rid_raw = r.get("id")
        try:
            rid = int(rid_raw)
        except Exception:
            logger.warning(f"⚠️ Could not cast round id '{rid_raw}' to int for history query")
            rid = None

        logger.info(f"📊 Fetching stats + history for INACTIVE round {slug} ({rid_raw})")

        # 1 — Stats
        stats = {}
        try:
            resp_stats = run_query(
                qf_round_stats_query, {"slug": slug}, endpoint=GIVETH_ENDPOINT
            )
            stats = resp_stats.get("qfRoundStats") or {}
        except Exception as e:
            logger.error(f"❌ Error fetching stats for round {slug}: {e}")

        # 2 — History
        history = {}
        if rid is not None:
            try:
                resp_hist = run_query(
                    qf_round_history_query, {"qfRoundId": rid}, endpoint=GIVETH_ENDPOINT
                )
                history = resp_hist.get("getQfRoundHistory") or {}
            except Exception as e:
                logger.error(f"❌ Error fetching history for round {slug}: {e}")
        else:
            logger.warning(f"⚠️ Skipping history for round {slug} due to invalid id")

        # Merge base round metadata + stats + history.
        # Keep qfRound and history nested so flatten_dict yields qfRound_* and history_* fields.
        combined_round = {
            **r,
            **{k: v for k, v in stats.items() if k != "qfRound"},
            "qfRound": stats.get("qfRound") or {},
            "history": history,
        }

        all_rounds_flat.append(flatten_dict(combined_round))
        time.sleep(0.3)

    if all_rounds_flat:
        qf_rounds_df = align_columns(all_rounds_flat)
        logger.info(
            f"📦 Stats+history+metadata loaded for {len(qf_rounds_df)} inactive rounds"
        )
    else:
        qf_rounds_df = align_columns([])
        logger.warning("⚠️ No rounds to write for bronze_giveth_qf_rounds")

    # =============================
    # 4. FETCH PROJECTS FOR INACTIVE ROUNDS
    # =============================
    projects_query = """
    query GetProjects($qfRoundId: Int!, $skip: Int!, $take: Int!) {
      allProjects(
        qfRoundId: $qfRoundId,
        skip: $skip,
        take: $take,
        orderBy: { field: CreationDate, direction: DESC }
      ) {
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
          categories { id }
          qfRounds { id title }
          balance
          stripeAccountId
          walletAddress
          verified
          verificationStatus
          isImported
          giveBacks
          donations { id }
          qualityScore
          contacts { url }
          reactions { id }
          addresses { id }
          socialMedia { id }
          anchorContracts { id }
          status { id name }
          adminUserId
          statusHistory { id }
          projectVerificationForm { id }
          featuredUpdate { id }
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

    all_projects: list[dict] = []
    PAGE_SIZE = 50
    MAX_PAGES = 1500

    for r in inactive_rounds:
        rid = int(r["id"])
        slug = r.get("slug")
        logger.info(f"📥 Fetching projects for inactive round {slug} ({rid})")

        skip = 0
        seen_ids: set[str] = set()
        total_for_round = 0

        for _ in range(MAX_PAGES):
            try:
                resp = run_query(
                    projects_query,
                    {"qfRoundId": rid, "skip": skip, "take": PAGE_SIZE},
                    endpoint=GIVETH_ENDPOINT,
                )
            except Exception as e:
                logger.error(
                    f"❌ Error fetching projects for round {slug} at skip={skip}: {e}"
                )
                break

            projects = resp.get("allProjects", {}).get("projects", []) or []
            if not projects:
                break

            for p in projects:
                pid = p.get("id")
                if pid in seen_ids:
                    # Already processed this project for this round
                    continue
                seen_ids.add(pid)

                # Attach round context so downstream mapping can join to grant pool
                enriched = {
                    **p,
                    "qfRoundId": rid,
                    "qfRoundSlug": slug,
                }
                all_projects.append(flatten_dict(enriched))
                total_for_round += 1

            if len(projects) < PAGE_SIZE:
                # Last page for this round
                break

            skip += PAGE_SIZE
            time.sleep(0.5)

        logger.info(
            f"📦 Total unique projects fetched for round {slug}: {total_for_round}"
        )

    if all_projects:
        projects_df = align_columns(all_projects)
        logger.info(
            f"📦 Total unique projects across all inactive rounds: {len(projects_df)}"
        )
    else:
        projects_df = align_columns([])
        logger.warning("⚠️ No projects fetched for inactive rounds")

    # =============================
    # 5. SANITIZE + WRITE TO DB
    # =============================
    logger.info("🧼 Sanitizing DataFrames for SQL compatibility...")
    qf_rounds_df = sanitize_for_sql(qf_rounds_df)
    projects_df = sanitize_for_sql(projects_df)

    logger.info("💾 Writing Bronze tables to Postgres...")

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

    logger.info(
        f"✨ Rows written: rounds={len(qf_rounds_df)}, projects={len(projects_df)}"
    )

    upsert_platform_metadata(engine, "giveth", data_source="Giveth GraphQL API")

    yield Output(qf_rounds_df, "bronze__giveth_qf_rounds")
    yield Output(projects_df, "bronze__giveth_projects")
