# og_dagster/tests/test_scf_integration.py
"""
Integration test: Verify Airtable API returns data compatible with
the existing bronze table schema (matching CSV export format).

Requires AIRTABLE_API_KEY to be set. Skips gracefully if not available.
"""

import os
import sys

import pytest

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from configs.scf_airtable import SCF_BASE_ID, SCF_TABLES, SCF_REQUIRED_COLUMNS
from utils.airtable_helpers import fetch_airtable_table

# Build test config from shared constants
SCF_TEST_TABLES = {
    table_name: {
        "table_id": table_id,
        "required_columns": SCF_REQUIRED_COLUMNS[table_name],
    }
    for table_name, table_id in SCF_TEST_TABLES.items()
}


@pytest.fixture
def api_key():
    key = os.getenv("AIRTABLE_API_KEY")
    if not key:
        pytest.skip("AIRTABLE_API_KEY not set — skipping integration test")
    return key


class TestSCFAirtableIntegration:
    """Verify Airtable API data matches expected bronze schema."""

    @pytest.mark.parametrize(
        "table_name,config",
        SCF_TEST_TABLES.items(),
        ids=SCF_TEST_TABLES.keys(),
    )
    def test_table_returns_records(self, api_key, table_name, config):
        """Each table returns at least one record."""
        records = fetch_airtable_table(
            base_id=SCF_BASE_ID,
            table_id=config["table_id"],
            api_key=api_key,
        )
        assert len(records) > 0, f"{table_name} returned 0 records"

    @pytest.mark.parametrize(
        "table_name,config",
        SCF_TEST_TABLES.items(),
        ids=SCF_TEST_TABLES.keys(),
    )
    def test_required_columns_present(self, api_key, table_name, config):
        """
        Required columns (referenced by YAML schema) exist in at least
        one record from each table.
        """
        records = fetch_airtable_table(
            base_id=SCF_BASE_ID,
            table_id=config["table_id"],
            api_key=api_key,
        )

        # Airtable only returns non-empty fields, so collect all column
        # names across all records to check availability
        all_columns = set()
        for record in records:
            all_columns.update(record.keys())

        # Remove internal field
        all_columns.discard("_airtable_id")

        for col in config["required_columns"]:
            assert col in all_columns, (
                f"Column '{col}' not found in {table_name}. "
                f"Available: {sorted(all_columns)}"
            )

    @pytest.mark.parametrize(
        "table_name,config",
        SCF_TEST_TABLES.items(),
        ids=SCF_TEST_TABLES.keys(),
    )
    def test_cellformat_returns_strings(self, api_key, table_name, config):
        """
        With cellFormat=string, all field values should be strings
        (matching CSV export behavior), not arrays or nested objects.
        """
        records = fetch_airtable_table(
            base_id=SCF_BASE_ID,
            table_id=config["table_id"],
            api_key=api_key,
        )

        for record in records[:5]:  # Check first 5 records
            for key, value in record.items():
                if key == "_airtable_id":
                    continue
                assert isinstance(value, str), (
                    f"{table_name}.{key} returned {type(value).__name__} "
                    f"instead of str: {value!r}"
                )

    def test_projects_currency_format(self, api_key):
        """Projects 'Total Awarded' field returns a parseable currency string."""
        records = fetch_airtable_table(
            base_id=SCF_BASE_ID,
            table_id=SCF_TEST_TABLES["bronze_scf_projects"]["table_id"],
            api_key=api_key,
        )

        found_currency = False
        for record in records:
            val = record.get("Total Awarded")
            if val and val.strip():
                # Should be parseable after removing $ and ,
                cleaned = val.replace("$", "").replace(",", "").strip()
                try:
                    float(cleaned)
                    found_currency = True
                    break
                except ValueError:
                    pass

        assert found_currency, "No parseable currency values found in Total Awarded"

    def test_rounds_linked_records_as_strings(self, api_key):
        """
        With cellFormat=string, linked record fields (like 'Submissions')
        should return as display strings, not arrays of record IDs.
        """
        records = fetch_airtable_table(
            base_id=SCF_BASE_ID,
            table_id=SCF_TEST_TABLES["bronze_scf_rounds"]["table_id"],
            api_key=api_key,
        )

        for record in records:
            submissions = record.get("Submissions")
            if submissions:
                # Should be a string (comma-separated), not a list
                assert isinstance(submissions, str), (
                    f"Submissions field is {type(submissions).__name__}, "
                    f"expected string. Value: {submissions!r}"
                )
                break
