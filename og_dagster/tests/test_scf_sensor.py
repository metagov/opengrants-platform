# og_dagster/tests/test_scf_sensor.py
"""Unit tests for the SCF Airtable webhook sensor."""

import json
import os
import sys
from unittest.mock import patch

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from dagster import build_sensor_context, DagsterInstance
from sensors.scf_sensor import airtable_scf_sensor, _get_or_create_webhook


# ============================================================
# Helper to build a Dagster sensor context
# ============================================================


def _build_context(cursor=None):
    """Build a real Dagster SensorEvaluationContext."""
    return build_sensor_context(cursor=cursor)


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

    @patch("sensors.scf_sensor._get_or_create_webhook")
    def test_skips_when_webhook_setup_fails(self, mock_webhook):
        """Yields SkipReason when webhook setup raises an exception."""
        mock_webhook.side_effect = RuntimeError("API error")
        ctx = _build_context()

        with patch.dict(os.environ, {"AIRTABLE_API_KEY": "key123"}):
            results = list(airtable_scf_sensor(ctx))

        assert len(results) == 1
        assert "Webhook setup failed" in str(results[0])

    @patch("sensors.scf_sensor._get_or_create_webhook")
    def test_skips_when_no_webhook_id(self, mock_webhook):
        """Yields SkipReason when webhook setup returns no webhook_id."""
        mock_webhook.return_value = {}
        ctx = _build_context()

        with patch.dict(os.environ, {"AIRTABLE_API_KEY": "key123"}):
            results = list(airtable_scf_sensor(ctx))

        assert len(results) == 1
        assert "No webhook ID available" in str(results[0])

    @patch("sensors.scf_sensor.poll_webhook")
    @patch("sensors.scf_sensor._get_or_create_webhook")
    def test_skips_when_poll_fails(self, mock_webhook, mock_poll):
        """Yields SkipReason when poll_webhook raises."""
        mock_webhook.return_value = {"webhook_id": "ach_1"}
        mock_poll.side_effect = RuntimeError("Network error")
        ctx = _build_context()

        with patch.dict(os.environ, {"AIRTABLE_API_KEY": "key123"}):
            results = list(airtable_scf_sensor(ctx))

        assert len(results) == 1
        assert "Poll failed" in str(results[0])

    @patch("sensors.scf_sensor.poll_webhook")
    @patch("sensors.scf_sensor._get_or_create_webhook")
    def test_handles_expired_webhook(self, mock_webhook, mock_poll):
        """Clears state and skips when webhook is expired."""
        mock_webhook.return_value = {"webhook_id": "ach_old", "cursor": 5}
        mock_poll.return_value = {"expired": True}
        ctx = _build_context(json.dumps({"webhook_id": "ach_old", "cursor": 5}))

        with patch.dict(os.environ, {"AIRTABLE_API_KEY": "key123"}):
            results = list(airtable_scf_sensor(ctx))

        assert len(results) == 1
        assert "expired" in str(results[0]).lower()

    @patch("sensors.scf_sensor.poll_webhook")
    @patch("sensors.scf_sensor._get_or_create_webhook")
    def test_triggers_run_on_changes(self, mock_webhook, mock_poll):
        """Yields RunRequest when payloads are detected."""
        mock_webhook.return_value = {"webhook_id": "ach_1", "cursor": 3}
        mock_poll.return_value = {
            "cursor": 5,
            "mightHaveMore": False,
            "payloads": [{"timestamp": "2026-03-21T12:00:00Z"}],
        }
        ctx = _build_context(json.dumps({"webhook_id": "ach_1", "cursor": 3}))

        with patch.dict(os.environ, {"AIRTABLE_API_KEY": "key123"}):
            results = list(airtable_scf_sensor(ctx))

        assert len(results) == 1
        assert hasattr(results[0], "run_key")

    @patch("sensors.scf_sensor.poll_webhook")
    @patch("sensors.scf_sensor._get_or_create_webhook")
    def test_skips_when_no_changes(self, mock_webhook, mock_poll):
        """Yields SkipReason when no payloads returned."""
        mock_webhook.return_value = {"webhook_id": "ach_1", "cursor": 3}
        mock_poll.return_value = {
            "cursor": 3,
            "mightHaveMore": False,
            "payloads": [],
        }
        ctx = _build_context(json.dumps({"webhook_id": "ach_1", "cursor": 3}))

        with patch.dict(os.environ, {"AIRTABLE_API_KEY": "key123"}):
            results = list(airtable_scf_sensor(ctx))

        assert len(results) == 1
        assert "No changes detected" in str(results[0])

    @patch("sensors.scf_sensor.poll_webhook")
    @patch("sensors.scf_sensor._get_or_create_webhook")
    def test_drains_might_have_more(self, mock_webhook, mock_poll):
        """Loops to drain all payloads when mightHaveMore is true."""
        mock_webhook.return_value = {"webhook_id": "ach_1", "cursor": 1}
        mock_poll.side_effect = [
            {
                "cursor": 3,
                "mightHaveMore": True,
                "payloads": [{"change": "a"}],
            },
            {
                "cursor": 5,
                "mightHaveMore": False,
                "payloads": [{"change": "b"}],
            },
        ]
        ctx = _build_context(json.dumps({"webhook_id": "ach_1", "cursor": 1}))

        with patch.dict(os.environ, {"AIRTABLE_API_KEY": "key123"}):
            results = list(airtable_scf_sensor(ctx))

        assert len(results) == 1
        assert hasattr(results[0], "run_key")
        assert mock_poll.call_count == 2

    def test_handles_corrupt_cursor(self):
        """Recovers gracefully from corrupt cursor JSON."""
        ctx = _build_context("not-valid-json{{{")

        with patch.dict(os.environ, {"AIRTABLE_API_KEY": "key123"}):
            with patch("sensors.scf_sensor._get_or_create_webhook") as mock_wh:
                mock_wh.return_value = {}
                results = list(airtable_scf_sensor(ctx))

        # Should not crash — just defaults to empty state
        assert len(results) == 1


# ============================================================
# _get_or_create_webhook tests
# ============================================================


class TestGetOrCreateWebhook:
    """Tests for webhook lifecycle management."""

    @patch("sensors.scf_sensor.refresh_webhook")
    def test_refreshes_existing_webhook(self, mock_refresh):
        """Returns existing state when refresh succeeds."""
        mock_refresh.return_value = True
        state = {"webhook_id": "ach_1", "cursor": 5}

        result = _get_or_create_webhook("key123", state)

        assert result["webhook_id"] == "ach_1"
        assert result["cursor"] == 5
        mock_refresh.assert_called_once()

    @patch("sensors.scf_sensor.list_webhooks")
    @patch("sensors.scf_sensor.refresh_webhook")
    def test_finds_existing_webhook_when_refresh_fails(self, mock_refresh, mock_list):
        """Falls back to listing webhooks when refresh fails."""
        mock_refresh.return_value = False
        mock_list.return_value = [{"id": "ach_existing"}]
        state = {"webhook_id": "ach_old", "cursor": 5}

        result = _get_or_create_webhook("key123", state)

        assert result["webhook_id"] == "ach_existing"
        assert result["cursor"] is None  # Reset for new webhook

    @patch("sensors.scf_sensor.create_webhook")
    @patch("sensors.scf_sensor.list_webhooks")
    @patch("sensors.scf_sensor.refresh_webhook")
    def test_creates_new_webhook_when_none_exist(
        self, mock_refresh, mock_list, mock_create
    ):
        """Creates a new webhook when no existing ones are found."""
        mock_refresh.return_value = False
        mock_list.return_value = []
        mock_create.return_value = {"id": "ach_new", "cursor": 1}
        state = {"webhook_id": "ach_old"}

        result = _get_or_create_webhook("key123", state)

        assert result["webhook_id"] == "ach_new"
        assert result["cursor"] == 1
        mock_create.assert_called_once()

    @patch("sensors.scf_sensor.create_webhook")
    @patch("sensors.scf_sensor.list_webhooks")
    def test_creates_webhook_from_scratch(self, mock_list, mock_create):
        """Creates a webhook when no stored webhook_id exists."""
        mock_list.return_value = []
        mock_create.return_value = {"id": "ach_fresh", "cursor": 0}
        state = {}

        result = _get_or_create_webhook("key123", state)

        assert result["webhook_id"] == "ach_fresh"
