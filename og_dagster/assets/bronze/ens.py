# og_dagster/assets/bronze/ens.py
"""Bronze layer: Load ENS Small Grants data from JSON files into Postgres."""

import json
import os
import re

import polars as pl
from dagster import AssetOut, Output, multi_asset

from utils.db import get_pg_engine
from utils.graphql_helpers import logger, sanitize_for_sql

RAW_DATA_PATH = os.getenv("RAW_DATA_PATH", "/app/raw_data")
ENS_DATA_PATH = os.path.join(RAW_DATA_PATH, "ENS", "grants")


@multi_asset(
    group_name="bronze",
    outs={
        "bronze__ens_proposals": AssetOut(
            metadata={"description": "Raw ENS Small Grants proposals from Snapshot (small-grants.eth)"},
            tags={"layer": "bronze", "source": "ens", "domain": "grants"},
        ),
        "bronze__ens_project_choices": AssetOut(
            metadata={"description": "ENS proposals exploded per choice/applicant with voting scores"},
            tags={"layer": "bronze", "source": "ens", "domain": "grants"},
        ),
        "bronze__ens_votes": AssetOut(
            metadata={"description": "Individual votes cast on ENS Small Grants proposals"},
            tags={"layer": "bronze", "source": "ens", "domain": "grants"},
        ),
    },
)
def fetch_ens_data():
    """
    Load ENS Small Grants data from local JSON files into Postgres bronze tables.

    Produces:
    - bronze_ens_proposals: one row per Snapshot proposal (round)
    - bronze_ens_project_choices: one row per (proposal, choice) — each applicant in each round
    - bronze_ens_votes: one row per individual vote
    """
    engine = get_pg_engine()

    proposals_path = os.path.join(ENS_DATA_PATH, "smallgrants_proposals.json")
    votes_path = os.path.join(ENS_DATA_PATH, "smallgrants_votes.json")

    logger.info(f"Loading ENS proposals from {proposals_path}")
    with open(proposals_path, "r", encoding="utf-8") as f:
        proposals = json.load(f)

    logger.info(f"Loading ENS votes from {votes_path}")
    with open(votes_path, "r", encoding="utf-8") as f:
        votes = json.load(f)

    # ---------------------------------------------------------------
    # 1. bronze_ens_proposals — flat rows, choices/scores as JSON
    # ---------------------------------------------------------------
    proposal_rows = []
    for p in proposals:
        proposal_rows.append({
            "id": p.get("id"),
            "title": p.get("title"),
            "body": p.get("body"),
            "start_ts": p.get("start"),
            "end_ts": p.get("end"),
            "snapshot": str(p.get("snapshot", "")),
            "state": p.get("state"),
            "author": p.get("author"),
            "created": p.get("created"),
            "scores_total": p.get("scores_total"),
            "votes": p.get("votes"),
            "quorum": p.get("quorum"),
            "vote_type": p.get("type"),
            "choices": json.dumps(p.get("choices", [])),
            "scores": json.dumps(p.get("scores", [])),
            "total_choices": len(p.get("choices", [])),
        })

    proposals_df = sanitize_for_sql(pl.DataFrame(proposal_rows))
    proposals_df.write_database(
        table_name="bronze_ens_proposals",
        connection=engine,
        if_table_exists="replace",
    )
    logger.info(f"Written {len(proposals_df)} rows to bronze_ens_proposals")

    # ---------------------------------------------------------------
    # 2. bronze_ens_project_choices — one row per (proposal × choice)
    # ---------------------------------------------------------------
    choice_rows = []
    for p in proposals:
        pid = p["id"]
        title = p.get("title", "")
        choices = p.get("choices", [])
        scores = p.get("scores", [])
        scores_total = p.get("scores_total", 0)
        start_ts = p.get("start")
        end_ts = p.get("end")
        state = p.get("state", "")

        # Derive round_type and round_number from title
        # e.g. "Public Goods Round 13" → type="Public Goods", num=13
        m = re.match(r'^(.*?)\s+Round\s+(\d+)', title)
        round_type = m.group(1).strip() if m else title
        round_number = int(m.group(2)) if m else None

        for idx, choice_text in enumerate(choices):
            score = scores[idx] if idx < len(scores) else 0.0

            # Parse "971 - Swiss-Knife.xyz" → number=971, name="Swiss-Knife.xyz"
            cn_match = re.match(r'^(\d+)\s*-\s*(.+)$', choice_text.strip())
            choice_number = int(cn_match.group(1)) if cn_match else None
            choice_name = cn_match.group(2).strip() if cn_match else choice_text.strip()

            choice_rows.append({
                "proposal_id": pid,
                "proposal_title": title,
                "round_type": round_type,
                "round_number": round_number,
                "choice_index": idx,
                "choice_text": choice_text,
                "choice_number": choice_number,
                "choice_name": choice_name,
                "score": score,
                "scores_total": scores_total,
                "start_ts": start_ts,
                "end_ts": end_ts,
                "proposal_state": state,
            })

    choices_df = sanitize_for_sql(pl.DataFrame(choice_rows))
    choices_df.write_database(
        table_name="bronze_ens_project_choices",
        connection=engine,
        if_table_exists="replace",
    )
    logger.info(f"Written {len(choices_df)} rows to bronze_ens_project_choices")

    # ---------------------------------------------------------------
    # 3. bronze_ens_votes — one row per vote
    # ---------------------------------------------------------------
    vote_rows = []
    for v in votes:
        choice_val = v.get("choice")
        vote_rows.append({
            "id": v.get("id"),
            "voter": v.get("voter"),
            "vp": v.get("vp"),
            "created": v.get("created"),
            "choice": json.dumps(choice_val) if choice_val is not None else None,
            "proposal_id": v.get("proposal_id"),
        })

    votes_df = sanitize_for_sql(pl.DataFrame(vote_rows))
    votes_df.write_database(
        table_name="bronze_ens_votes",
        connection=engine,
        if_table_exists="replace",
    )
    logger.info(f"Written {len(votes_df)} rows to bronze_ens_votes")

    yield Output(proposals_df, "bronze__ens_proposals")
    yield Output(choices_df, "bronze__ens_project_choices")
    yield Output(votes_df, "bronze__ens_votes")
