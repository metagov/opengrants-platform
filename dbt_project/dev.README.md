# Database Management Commands

## dbt Execution Commands

```bash
# Use your main Postgres for production runs
dbt run --target dev_postgres

# Use DuckDB for local analytics / dashboards
dbt run --target dev_duckdb

# List available resources
docker compose run dbt list --resource-type source

# Build and run dbt in Docker
docker compose build dbt
docker compose run dbt run
```

## Database Access Commands

```bash
# Access Postgres database
docker exec -it postgres psql -U postgres -d opengrants

# Access DuckDB database
duckdb dbt_project/local.duckdb

# Show tables in DuckDB
SHOW TABLES;

# Query sample data from DuckDB
SELECT * FROM gold__funding_metrics LIMIT 10;
```

## File Management Commands

```bash
# Navigate to downloads directory
cd /mnt/c/Users/rashm/Downloads

# Copy CSV file to SCF data directory
cp 'Build Award Rounds-By Year - 11_November_2025.csv' /home/torch/opengrants-platform/raw_data/SCF/11_November_2025/
```

## Seed Data Management

```bash
# Add seed data to dbt
# 1. Create a CSV file at /seeds/<filename>.csv
# 2. Run seed command

# Example: seed privote_grant_pool data
docker compose run --rm dbt seed --select privote_grant_pool
```

## Database Strategy Decision Matrix

### Use Case Analysis

| Use Case | Postgres | DuckDB | Recommendation |
|----------|----------|---------|----------------|
| **Persistent store (source of truth)** | ✅ Excellent - durable, transactional, reliable | ❌ Not ideal - file-based, non-transactional | ✅ Keep Postgres as source of truth |
| **Analytics queries (dashboard backend)** | ⚠️ Good, but slower for OLAP joins & aggregations | ✅ Excellent for analytical workloads | ✅ DuckDB if dashboards need fast, interactive slicing |
| **Data volume (< few GBs)** | ✅ Handles easily | ✅ Overkill (no real gain) | ❌ Stick with Postgres for now |
| **Multi-user concurrent reads** | ✅ Built for this | ⚠️ Limited concurrency | ✅ Postgres for team or web apps |
| **Local prototyping / caching** | ⚠️ Requires DB connection | ✅ Instant and local | Optional DuckDB cache for local/offline use |
| **dbt integration** | ✅ Excellent | ✅ Excellent | You can mix targets easily (dual profiles) |

### Implementation Timeline

| Phase | Storage | Dashboard Backend | Reason |
|-------|---------|-------------------|---------|
| **Now** | ✅ Postgres only | Connect directly (Next.js API / Superset) | Simplicity, sufficient performance |
| **Later** | Postgres (truth) + DuckDB (cache) | Dashboard hits DuckDB | Faster analytics when data grows |
| **Maybe later** | Postgres + Parquet (S3) + DuckDB | Cloud-scale | If ecosystems >10GB data |

## Strategic Implementation Notes

### Current Architecture
- Full pipeline (Giveth) runs cleanly
- Bronze → Silver → Gold architecture in Postgres
- Metrics + dashboards models exist and are consistent
- Planning to ingest Stellar CSV (SCF) + future sources like Celo, Gitcoin

### Recommended Implementation Pipeline

**Phase 1 - Current State:** Postgres-only as source of truth
```
Bronze (Postgres) → Silver (Postgres) → Gold (Postgres)
```
- Dashboard connects directly via SQLMesh/Superset/Grafana/Next.js API

**Phase 2 - Future Scale:** Hybrid approach for larger datasets
```
Bronze (Postgres) → Silver (Postgres) → Gold (Postgres) → DuckDB cache
```
- Postgres remains truth layer
- DuckDB serves as analytical cache for dashboards
- For larger datasets: Gitcoin, SCF, Celo, Karma GAP, Questbook API

### Implementation Steps
1. Import Stellar CSV → Bronze layer
2. Define Silver schema for SCF
3. Add SCF Gold Metrics in dbt
4. Build Dashboard with Next.js + Postgres/DuckDB