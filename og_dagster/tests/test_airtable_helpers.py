# og_dagster/tests/test_airtable_helpers.py
"""Unit tests for Airtable API helpers."""

import json
from unittest.mock import MagicMock, patch

import pytest

# Adjust path so we can import from the og_dagster package
import sys
import os
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from utils.airtable_helpers import (
    fetch_airtable_table,
    create_webhook,
    list_webhooks,
    poll_webhook,
    refresh_webhook,
)


# ============================================================
# fetch_airtable_table tests
# ============================================================


class TestFetchAirtableTable:
    """Tests for paginated Airtable table fetching."""

    @patch("utils.airtable_helpers.requests.get")
    def test_single_page_no_offset(self, mock_get):
        """Fetches all records when response has no offset (single page)."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "records": [
                {"id": "rec1", "fields": {"Name": "Project A", "Total Awarded": "$10,000"}},
                {"id": "rec2", "fields": {"Name": "Project B", "Total Awarded": "$20,000"}},
            ]
        }
        mock_get.return_value = mock_response

        records = fetch_airtable_table("base123", "tbl456", "key789")

        assert len(records) == 2
        assert records[0]["Name"] == "Project A"
        assert records[1]["Total Awarded"] == "$20,000"
        assert records[0]["_airtable_id"] == "rec1"
        mock_get.assert_called_once()

        # Verify cellFormat=string is passed
        call_args = mock_get.call_args
        assert call_args.kwargs["params"]["cellFormat"] == "string"
        assert call_args.kwargs["params"]["userLocale"] == "en"

    @patch("utils.airtable_helpers.requests.get")
    def test_multi_page_pagination(self, mock_get):
        """Follows offset tokens across multiple pages."""
        page1 = MagicMock()
        page1.status_code = 200
        page1.json.return_value = {
            "records": [{"id": "rec1", "fields": {"Name": "A"}}],
            "offset": "itr_page2",
        }

        page2 = MagicMock()
        page2.status_code = 200
        page2.json.return_value = {
            "records": [{"id": "rec2", "fields": {"Name": "B"}}],
        }

        mock_get.side_effect = [page1, page2]

        records = fetch_airtable_table("base123", "tbl456", "key789")

        assert len(records) == 2
        assert records[0]["Name"] == "A"
        assert records[1]["Name"] == "B"
        assert mock_get.call_count == 2

        # Second call should include offset
        second_call_params = mock_get.call_args_list[1].kwargs["params"]
        assert second_call_params["offset"] == "itr_page2"

    @patch("utils.airtable_helpers.requests.get")
    def test_empty_table(self, mock_get):
        """Handles a table with zero records."""
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {"records": []}
        mock_get.return_value = mock_response

        records = fetch_airtable_table("base123", "tbl456", "key789")

        assert len(records) == 0

    @patch("utils.airtable_helpers.requests.get")
    @patch("utils.airtable_helpers.time.sleep")
    def test_rate_limit_retry(self, mock_sleep, mock_get):
        """Retries on 429 rate limit with exponential backoff."""
        rate_limited = MagicMock()
        rate_limited.status_code = 429

        success = MagicMock()
        success.status_code = 200
        success.json.return_value = {
            "records": [{"id": "rec1", "fields": {"Name": "A"}}]
        }

        mock_get.side_effect = [rate_limited, success]

        records = fetch_airtable_table("base123", "tbl456", "key789")

        assert len(records) == 1
        mock_sleep.assert_called_once_with(2)  # 2^(0+1) = 2

    @patch("utils.airtable_helpers.requests.get")
    @patch("utils.airtable_helpers.time.sleep")
    def test_server_error_retry(self, mock_sleep, mock_get):
        """Retries on 500 server errors."""
        error = MagicMock()
        error.status_code = 500

        success = MagicMock()
        success.status_code = 200
        success.json.return_value = {"records": []}

        mock_get.side_effect = [error, success]

        records = fetch_airtable_table("base123", "tbl456", "key789")
        assert len(records) == 0
        mock_sleep.assert_called_once_with(1)  # 2^0 = 1

    @patch("utils.airtable_helpers.requests.get")
    @patch("utils.airtable_helpers.time.sleep")
    def test_max_retries_exceeded(self, mock_sleep, mock_get):
        """Raises RuntimeError after max retries exhausted."""
        error = MagicMock()
        error.status_code = 500

        mock_get.return_value = error

        with pytest.raises(RuntimeError, match="failed after 3 retries"):
            fetch_airtable_table("base123", "tbl456", "key789")

    @patch("utils.airtable_helpers.requests.get")
    def test_auth_error_raises_immediately(self, mock_get):
        """401/403 errors raise immediately without retry."""
        mock_response = MagicMock()
        mock_response.status_code = 401
        mock_response.raise_for_status.side_effect = Exception("Unauthorized")
        mock_get.return_value = mock_response

        with pytest.raises(Exception, match="Unauthorized"):
            fetch_airtable_table("base123", "tbl456", "key789")


# ============================================================
# Webhook tests
# ============================================================


class TestWebhookHelpers:
    """Tests for webhook registration, polling, and refresh."""

    @patch("utils.airtable_helpers.requests.post")
    def test_create_webhook(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "id": "ach_123",
            "macSecretBase64": "secret",
            "cursor": 1,
        }
        mock_post.return_value = mock_response

        result = create_webhook("base123", "key789")

        assert result["id"] == "ach_123"
        assert result["cursor"] == 1

    @patch("utils.airtable_helpers.requests.get")
    def test_list_webhooks(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "webhooks": [{"id": "ach_1"}, {"id": "ach_2"}]
        }
        mock_get.return_value = mock_response

        result = list_webhooks("base123", "key789")
        assert len(result) == 2

    @patch("utils.airtable_helpers.requests.get")
    def test_poll_webhook_with_payloads(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "cursor": 5,
            "mightHaveMore": False,
            "payloads": [
                {"timestamp": "2026-03-21T12:00:00Z", "actionMetadata": {}},
            ],
        }
        mock_get.return_value = mock_response

        result = poll_webhook("base123", "ach_1", cursor=3, api_key="key789")

        assert result["cursor"] == 5
        assert len(result["payloads"]) == 1

    @patch("utils.airtable_helpers.requests.get")
    def test_poll_webhook_no_changes(self, mock_get):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "cursor": 3,
            "mightHaveMore": False,
            "payloads": [],
        }
        mock_get.return_value = mock_response

        result = poll_webhook("base123", "ach_1", cursor=3, api_key="key789")
        assert len(result["payloads"]) == 0

    @patch("utils.airtable_helpers.requests.get")
    def test_poll_webhook_expired_404(self, mock_get):
        """Returns expired flag when webhook returns 404."""
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_get.return_value = mock_response

        result = poll_webhook("base123", "ach_old", cursor=1, api_key="key789")
        assert result["expired"] is True

    @patch("utils.airtable_helpers.requests.post")
    def test_refresh_webhook_success(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_post.return_value = mock_response

        assert refresh_webhook("base123", "ach_1", "key789") is True

    @patch("utils.airtable_helpers.requests.post")
    def test_refresh_webhook_failure(self, mock_post):
        mock_response = MagicMock()
        mock_response.status_code = 404
        mock_post.return_value = mock_response

        assert refresh_webhook("base123", "ach_old", "key789") is False
