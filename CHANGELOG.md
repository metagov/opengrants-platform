# Changelog

All notable changes to this project will be documented in this file.

## [0.1.0.0] - 2026-03-21

### Added
- Airtable API integration for SCF data ingestion, replacing CSV-based imports
- Paginated Airtable table fetcher with rate-limit retry and timeout handling
- Webhook-based sensor for automatic SCF pipeline triggering on data changes
- Full SCF ETL pipeline job (bronze -> silver) with Dagster asset dependencies
- Shared SCF Airtable config module for DRY base/table ID management
- Comprehensive test suites: 16 unit tests for Airtable helpers, 13 for sensor logic
- Integration tests validating Airtable API schema compatibility
- TODOS.md for tracking deferred work items

### Changed
- Bronze SCF asset now uses Dagster resource management and Polars `write_database`
- Silver SCF assets now declare explicit dependency on bronze asset via `AssetKey`
- Docker Compose entrypoint auto-generates dbt manifest before Dagster startup
- Airtable helpers use standard Python `logging` instead of Dagster-specific logger

### Removed
- Legacy CSV-based SCF ingestion (`bronze_scf_csv_ingest`)
- Standalone `etl_scf_job.py` (consolidated into `definitions.py`)
