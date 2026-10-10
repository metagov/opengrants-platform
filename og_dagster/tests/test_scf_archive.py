"""Unit tests for the SCF archive (utils/scf_archive.py), on an in-memory SQLite engine."""

import json
import os
import sys

import pytest
from sqlalchemy import create_engine, text

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.scf_archive import (
    PUBLISHED_IDS,
    SNAPSHOTS,
    archive_bronze_snapshot,
    canonical_payload,
    record_published_ids,
)


@pytest.fixture
def engine():
    return create_engine("sqlite://")


def _rows(engine, sql):
    with engine.connect() as c:
        return c.execute(text(sql)).all()


RECORDS = [
    {"_airtable_id": "rec2", "Title": "Beta", "Total Awarded": "$20,000"},
    {"_airtable_id": "rec1", "Title": "Alpha", "Total Awarded": "$10,000"},
]


class TestBronzeSnapshots:
    def test_first_snapshot_is_written_with_record_ids(self, engine):
        assert archive_bronze_snapshot(engine, "bronze_scf_projects", RECORDS, run_id="r1") is True
        (count, payload, run_id), = _rows(engine, f"SELECT record_count, payload, run_id FROM {SNAPSHOTS}")
        assert count == 2 and run_id == "r1"
        assert [r["_airtable_id"] for r in json.loads(payload)] == ["rec1", "rec2"]

    def test_identical_content_is_not_archived_twice(self, engine):
        archive_bronze_snapshot(engine, "bronze_scf_projects", RECORDS)
        assert archive_bronze_snapshot(engine, "bronze_scf_projects", list(reversed(RECORDS))) is False
        assert len(_rows(engine, f"SELECT 1 FROM {SNAPSHOTS}")) == 1

    def test_changed_content_is_archived(self, engine):
        archive_bronze_snapshot(engine, "bronze_scf_projects", RECORDS)
        renamed = [dict(RECORDS[0], Title="Beta Renamed"), RECORDS[1]]
        assert archive_bronze_snapshot(engine, "bronze_scf_projects", renamed) is True
        assert len(_rows(engine, f"SELECT 1 FROM {SNAPSHOTS}")) == 2

    def test_tables_are_deduplicated_independently(self, engine):
        archive_bronze_snapshot(engine, "bronze_scf_projects", RECORDS)
        assert archive_bronze_snapshot(engine, "bronze_scf_rounds", RECORDS) is True

    def test_payload_hash_is_order_independent(self):
        assert canonical_payload(RECORDS)[1] == canonical_payload(list(reversed(RECORDS)))[1]


class TestPublishedIds:
    def test_new_ids_recorded_and_vanished_ids_kept(self, engine):
        assert record_published_ids(engine, "project", [("daoip-5:scf:project:a", "A"),
                                                        ("daoip-5:scf:project:b", "B")]) == 2
        # Next run: "b" renamed to "c" upstream. "b" must survive with its original name.
        assert record_published_ids(engine, "project", [("daoip-5:scf:project:a", "A"),
                                                        ("daoip-5:scf:project:c", "C")]) == 1
        rows = {r[0]: r for r in _rows(engine, f"SELECT daoip5_id, name, first_seen_at, last_seen_at FROM {PUBLISHED_IDS}")}
        assert set(rows) == {"daoip-5:scf:project:a", "daoip-5:scf:project:b", "daoip-5:scf:project:c"}
        assert rows["daoip-5:scf:project:b"][1] == "B"
        # "a" was seen again, so its last_seen_at moved; "b" was not.
        assert rows["daoip-5:scf:project:a"][3] > rows["daoip-5:scf:project:a"][2]
        assert rows["daoip-5:scf:project:b"][3] == rows["daoip-5:scf:project:b"][2]

    def test_null_ids_ignored(self, engine):
        assert record_published_ids(engine, "grantApplication", [(None, "x"), ("", "y")]) == 0
