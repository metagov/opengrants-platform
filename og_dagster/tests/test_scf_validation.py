"""Unit tests for the SCF data accuracy gate (utils/scf_validation.py), on in-memory SQLite."""

import json
import os
import sys

import polars as pl
import pytest
from sqlalchemy import create_engine, text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.scf_validation import (
    RUNS_TABLE,
    SECTIONS,
    record_validation,
    render_report,
    validate_scf_candidates,
)

PAID = "org.stellar.communityfund.totalPaidUSD"
AWARDED = "org.stellar.communityfund.totalAwardedUSD"


def make_frames(n_projects=50, rename=0, award=1000.0):
    names = [f"P{i}" + (" Renamed" if i < rename else "") for i in range(n_projects)]
    pid = lambda n: f"daoip-5:scf:project:{n.lower().replace(' ', '_')}"
    projects = pl.DataFrame({"id": [pid(n) for n in names], "name": names, AWARDED: [award] * n_projects})
    apps = pl.DataFrame({
        "id": [f"daoip-5:scf:application:{n.lower().replace(' ', '_')}" for n in names],
        "name": names,
        "projectId": [pid(n) for n in names],
        "grantPoolId": ["daoip-5:scf:grantPool:scf_#1"] * n_projects,
        "fundsApprovedInUSD": [award] * n_projects,
        PAID: [award / 2] * n_projects,
        "status": ["approved"] * n_projects,
    })
    pools = pl.DataFrame({"id": ["daoip-5:scf:grantPool:scf_#1"], "name": ["SCF #1"], AWARDED: [award * n_projects]})
    return {"projects": projects, "grant_applications": apps, "grant_pools": pools}


@pytest.fixture
def engine():
    return create_engine("sqlite://")


def publish(engine, frames):
    for section, df in frames.items():
        df.to_pandas().to_sql(SECTIONS[section], engine, if_exists="replace", index=False)


def checks(result, severity):
    return {(f.table, f.check) for f in result.findings if f.severity == severity}


def test_clean_first_load_passes(engine):
    res = validate_scf_candidates(engine, make_frames())
    assert res.passed
    assert ("silver_scf_projects", "live_comparison") in checks(res, "warn")


def test_identical_update_passes_without_warnings_beyond_none(engine):
    publish(engine, make_frames())
    res = validate_scf_candidates(engine, make_frames())
    assert res.passed and not res.warnings


def test_truncated_pull_blocks(engine):
    publish(engine, make_frames(50))
    res = validate_scf_candidates(engine, make_frames(30))
    blocked = checks(res, "block")
    assert ("silver_scf_projects", "row_count") in blocked
    assert ("silver_scf_grant_applications", "funding_total") in blocked
    assert ("silver_scf_projects", "ids_stable") in blocked


def test_a_few_renames_warn_and_many_block(engine):
    publish(engine, make_frames())
    few = validate_scf_candidates(engine, make_frames(rename=2))
    assert few.passed and ("silver_scf_projects", "ids_stable") in checks(few, "warn")
    many = validate_scf_candidates(engine, make_frames(rename=10))
    assert ("silver_scf_projects", "ids_stable") in checks(many, "block")


def test_zeroed_amounts_block(engine):
    publish(engine, make_frames())
    frames = make_frames()
    frames["grant_applications"] = frames["grant_applications"].with_columns(pl.lit(0.0).alias("fundsApprovedInUSD"))
    assert ("silver_scf_grant_applications", "funding_total") in checks(validate_scf_candidates(engine, frames), "block")


def test_field_going_empty_blocks(engine):
    publish(engine, make_frames())
    frames = make_frames()
    frames["projects"] = frames["projects"].with_columns(pl.lit(None, dtype=pl.Float64).alias(AWARDED))
    assert ("silver_scf_projects", "fields_populated") in checks(validate_scf_candidates(engine, frames), "block")


def test_dropped_column_blocks(engine):
    publish(engine, make_frames())
    frames = make_frames()
    frames["grant_applications"] = frames["grant_applications"].drop("status")
    assert ("silver_scf_grant_applications", "schema_stable") in checks(validate_scf_candidates(engine, frames), "block")


def test_bad_ids_and_negative_amounts_block(engine):
    frames = make_frames()
    frames["projects"] = frames["projects"].with_columns(
        pl.when(pl.int_range(pl.len()) == 0).then(pl.lit("scf:project:x")).otherwise(pl.col("id")).alias("id"))
    frames["grant_applications"] = frames["grant_applications"].with_columns(
        pl.when(pl.int_range(pl.len()) == 0).then(-5.0).otherwise(pl.col("fundsApprovedInUSD")).alias("fundsApprovedInUSD"))
    blocked = checks(validate_scf_candidates(engine, frames), "block")
    assert ("silver_scf_projects", "id_format") in blocked
    assert ("silver_scf_grant_applications", "amounts_valid") in blocked


def test_known_application_duplicates_warn(engine):
    frames = make_frames()
    frames["grant_applications"] = pl.concat([frames["grant_applications"], frames["grant_applications"].head(1)])
    res = validate_scf_candidates(engine, frames)
    assert ("silver_scf_grant_applications", "id_unique") in checks(res, "warn")


def test_project_duplicates_already_live_warn_but_new_ones_block(engine):
    live = make_frames()
    live["projects"] = pl.concat([live["projects"], live["projects"].head(1)])
    publish(engine, live)

    same = make_frames()
    same["projects"] = pl.concat([same["projects"], same["projects"].head(1)])
    res = validate_scf_candidates(engine, same)
    assert res.passed and ("silver_scf_projects", "id_unique") in checks(res, "warn")

    new = make_frames()
    new["projects"] = pl.concat([new["projects"], new["projects"].slice(1, 1)])
    res = validate_scf_candidates(engine, new)
    assert ("silver_scf_projects", "id_unique") in checks(res, "block")


def test_new_orphan_references_block(engine):
    publish(engine, make_frames())
    frames = make_frames()
    frames["grant_applications"] = frames["grant_applications"].with_columns(
        pl.lit("daoip-5:scf:grantPool:missing").alias("grantPoolId"))
    assert ("silver_scf_grant_applications", "references_resolve") in checks(validate_scf_candidates(engine, frames), "block")


def test_paid_over_awarded_only_warns(engine):
    frames = make_frames()
    frames["grant_applications"] = frames["grant_applications"].with_columns(pl.col("fundsApprovedInUSD").alias(PAID) * 2)
    res = validate_scf_candidates(engine, frames)
    assert res.passed and ("silver_scf_grant_applications", "paid_within_award") in checks(res, "warn")


def test_totals_must_reconcile_across_tables(engine):
    frames = make_frames()
    frames["grant_pools"] = frames["grant_pools"].with_columns(pl.col(AWARDED) * 2)
    assert ("silver_scf_grant_pools", "totals_reconcile") in checks(validate_scf_candidates(engine, frames), "block")


def test_outcome_recorded_and_reported(engine):
    publish(engine, make_frames(50))
    res = validate_scf_candidates(engine, make_frames(30))
    assert record_validation(engine, res, "run-1") == "blocked"
    assert record_validation(engine, res, "run-2", overridden=True) == "overridden"
    with engine.connect() as c:
        rows = c.execute(text(f"SELECT run_id, status, blocking, findings FROM {RUNS_TABLE} ORDER BY run_id")).all()
    assert [(r[0], r[1]) for r in rows] == [("run-1", "blocked"), ("run-2", "overridden")]
    assert rows[0][2] == len(res.blocking) and json.loads(rows[0][3])
    report = render_report(res, "run-1", "blocked")
    assert "Blocked" in report and "scf/accept_validation=true" in report


def test_xlm_rate_gaps_and_missing_awards_are_not_overpayments(engine):
    frames = make_frames()
    apps = frames["grant_applications"]
    paid = [a * 1.02 for a in apps["fundsApprovedInUSD"]]          # within the 2.5% allowance
    approved = apps["fundsApprovedInUSD"].to_list()
    approved[0], paid[0] = 0.0, 500.0                               # legacy award with no amount
    frames["grant_applications"] = apps.with_columns(
        pl.Series("fundsApprovedInUSD", approved), pl.Series(PAID, paid))
    warned = checks(validate_scf_candidates(engine, frames), "warn")
    assert ("silver_scf_grant_applications", "paid_within_award") not in warned
    assert ("silver_scf_grant_applications", "award_recorded") in warned


def test_empty_created_at_warns_until_bronze_has_created_time(engine):
    live = make_frames()
    live["grant_applications"] = live["grant_applications"].with_columns(pl.lit("2025-01-01T00:00:00Z").alias("createdAt"))
    publish(engine, live)
    frames = make_frames()
    frames["grant_applications"] = frames["grant_applications"].with_columns(
        pl.lit(None, dtype=pl.Utf8).alias("createdAt"))

    with engine.begin() as c:
        c.execute(text('CREATE TABLE bronze_scf_submissions ("Round" TEXT)'))
    res = validate_scf_candidates(engine, frames)
    assert ("silver_scf_grant_applications", "fields_populated") in checks(res, "warn")
    assert res.passed

    with engine.begin() as c:
        c.execute(text('ALTER TABLE bronze_scf_submissions ADD COLUMN "_airtable_created_time" TEXT'))
    res = validate_scf_candidates(engine, frames)
    assert ("silver_scf_grant_applications", "fields_populated") in checks(res, "block")
