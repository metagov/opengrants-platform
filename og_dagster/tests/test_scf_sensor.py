# og_dagster/tests/test_scf_sensor.py
"""Unit tests for the SCF Airtable record-count polling sensor."""

import json
import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dagster import build_sensor_context
from configs.scf_airtable import SCF_REQUIRED_COLUMNS, SCF_TABLES
from sensors.scf_sensor import airtable_scf_sensor, _get_table_fingerprint


def _build_context(cursor=None):
    """Build a real Dagster SensorEvaluationContext."""
    return build_sensor_context(cursor=cursor)


def _fake_records(prefix, n):
    """Build n fake Airtable record dicts with unique _airtable_id values."""
    return [{"_airtable_id": f"{prefix}{i}"} for i in range(n)]


# ============================================================
# _get_table_fingerprint tests
# ============================================================


class TestGetTableFingerprint:
    """Tests for the fingerprint builder."""

    def test_requests_valid_per_table_sentinel_field(self):
        """
        Regression test for the 422 UNKNOWN_FIELD_NAME bug.

        The sensor used to hardcode fields[]=Name for every table, but only
        bronze_scf_rounds has a Name column. Requesting it on the projects or
        submissions tables made Airtable return 422 Unprocessable Entity, so
        the sensor never fired. Each table must be fetched with a field that
        actually exists on it.
        """
        with patch("sensors.scf_sensor.fetch_airtable_table") as mock_fetch:
            mock_fetch.return_value = _fake_records("r", 3)
            _get_table_fingerprint("key123")

        # One fetch per table
        assert mock_fetch.call_count == len(SCF_TABLES)

        # Every call must request a real column of that table — never a blanket
        # "Name" that doesn't exist on projects/submissions.
        for call in mock_fetch.call_args_list:
            table_id = call.kwargs["table_id"]
            requested_field = call.kwargs["extra_params"]["fields[]"]
            table_name = next(
                name for name, tid in SCF_TABLES.items() if tid == table_id
            )
            assert requested_field == SCF_REQUIRED_COLUMNS[table_name][0]
            assert requested_field in SCF_REQUIRED_COLUMNS[table_name]

    def test_projects_table_does_not_request_name_field(self):
        """The projects table (tblQFNVNhCxfzUgbF) must not request 'Name'."""
        with patch("sensors.scf_sensor.fetch_airtable_table") as mock_fetch:
            mock_fetch.return_value = _fake_records("r", 1)
            _get_table_fingerprint("key123")

        projects_id = SCF_TABLES["bronze_scf_projects"]
        projects_call = next(
            c for c in mock_fetch.call_args_list
            if c.kwargs["table_id"] == projects_id
        )
        assert projects_call.kwargs["extra_params"]["fields[]"] != "Name"

    def test_fingerprint_changes_when_records_change(self):
        """A different set of record IDs produces a different fingerprint."""
        with patch("sensors.scf_sensor.fetch_airtable_table") as mock_fetch:
            mock_fetch.return_value = _fake_records("a", 3)
            fp1 = _get_table_fingerprint("key123")

        with patch("sensors.scf_sensor.fetch_airtable_table") as mock_fetch:
            mock_fetch.return_value = _fake_records("a", 4)
            fp2 = _get_table_fingerprint("key123")

        assert fp1 != fp2

    def test_fingerprint_stable_when_records_unchanged(self):
        """Identical record sets produce identical fingerprints."""
        with patch("sensors.scf_sensor.fetch_airtable_table") as mock_fetch:
            mock_fetch.return_value = _fake_records("a", 3)
            fp1 = _get_table_fingerprint("key123")
            fp2 = _get_table_fingerprint("key123")

        assert fp1 == fp2


# ============================================================
# airtable_scf_sensor tests
# ============================================================


class TestAirtableScfSensor:
    """Tests for the main sensor function."""

    def test_skips_when_no_api_key(self):
        """Yields SkipReason when AIRTABLE_API_KEY is not set."""
        ctx = _build_context()
        with patch.dict(os.environ, {}, clear=True):
            results = list(airtable_scf_sensor(ctx))

        assert len(results) == 1
        assert "AIRTABLE_API_KEY not set" in str(results[0])

    @patch("sensors.scf_sensor._get_table_fingerprint")
    def test_skips_when_fetch_fails(self, mock_fp):
        """Yields SkipReason when the fingerprint fetch raises."""
        mock_fp.side_effect = RuntimeError("422 Unprocessable Entity")
        ctx = _build_context()

        with patch.dict(os.environ, {"AIRTABLE_API_KEY": "key123"}):
            results = list(airtable_scf_sensor(ctx))

        assert len(results) == 1
        assert "Airtable fetch failed" in str(results[0])

    @patch("sensors.scf_sensor._get_table_fingerprint")
    def test_first_run_records_baseline(self, mock_fp):
        """First run records a baseline and does not trigger a run."""
        mock_fp.return_value = "abc123"
        ctx = _build_context()  # no cursor

        with patch.dict(os.environ, {"AIRTABLE_API_KEY": "key123"}):
            results = list(airtable_scf_sensor(ctx))

        assert len(results) == 1
        assert "baseline" in str(results[0]).lower()

    @patch("sensors.scf_sensor._get_table_fingerprint")
    def test_triggers_run_on_change(self, mock_fp):
        """Yields RunRequest when the fingerprint changes."""
        mock_fp.return_value = "new_fingerprint"
        ctx = _build_context(json.dumps({"fingerprint": "old_fingerprint"}))

        with patch.dict(os.environ, {"AIRTABLE_API_KEY": "key123"}):
            results = list(airtable_scf_sensor(ctx))

        assert len(results) == 1
        assert hasattr(results[0], "run_key")

    @patch("sensors.scf_sensor._get_table_fingerprint")
    def test_skips_when_no_change(self, mock_fp):
        """Yields SkipReason when the fingerprint is unchanged."""
        mock_fp.return_value = "same_fingerprint"
        ctx = _build_context(json.dumps({"fingerprint": "same_fingerprint"}))

        with patch.dict(os.environ, {"AIRTABLE_API_KEY": "key123"}):
            results = list(airtable_scf_sensor(ctx))

        assert len(results) == 1
        assert "No changes detected" in str(results[0])

    @patch("sensors.scf_sensor._get_table_fingerprint")
    def test_handles_corrupt_cursor(self, mock_fp):
        """Recovers gracefully from corrupt cursor JSON (treated as first run)."""
        mock_fp.return_value = "abc123"
        ctx = _build_context("not-valid-json{{{")

        with patch.dict(os.environ, {"AIRTABLE_API_KEY": "key123"}):
            results = list(airtable_scf_sensor(ctx))

        # Should not crash — corrupt cursor resets to empty state (baseline)
        assert len(results) == 1
        assert "baseline" in str(results[0]).lower()
