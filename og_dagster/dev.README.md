# Database Management Commands

## Docker & Dagster Commands

```bash
# Build and run Dagster
docker compose build dagster
docker compose up dagster

# Verbose mode for debugging
docker compose --verbose up dagster

# Restart Dagster service
docker compose restart dagster
```

## PostgreSQL Commands

```bash
# Access PostgreSQL database
docker exec -it postgres psql -U postgres -d opengrants

# List bronze tables
\dt bronze_*

# Switch to opengrants database and describe tables
\c opengrants
\d bronze_giveth_qf_rounds
\d bronze_giveth_projects
```

## Data Pipeline Architecture

### Layer Structure

| Layer | Folder | Example Asset | Depends On | Destination Table |
|-------|--------|---------------|------------|-------------------|
| 🟤 Bronze | `ops/` | `fetch_giveth_data` | — | `bronze_giveth_*` |
| ⚪ Silver | `assets/silver/` | `silver_giveth_projects` / `silver_giveth_rounds` | Bronze outputs | `silver_daoip5_*` |
| 🟡 Configs | `configs/schema_maps/` | YAML field mappings | Used by Silver assets | — |

### Data Flow & Storage

| Layer | Source | Refreshed By | Used For |
|-------|--------|--------------|----------|
| **Silver** | Postgres | Dagster | Raw normalized data |
| **Silver Cache** | DuckDB | Dagster sync op | Fast dashboards |
| **Gold** | Postgres | dbt | Aggregated metrics |
| **Gold Cache** | DuckDB | dbt macro | Ecosystem stats |
| **Dashboard** | DuckDB (primary), Postgres (fallback) | — | User interface |

## Database Operations

### Update GIV-ARB AllocatedFundUSD
```sql
UPDATE bronze_giveth_qf_rounds                                                          
SET "qfRound_allocatedFundUSD" = 127350 
WHERE "bronze_giveth_qf_rounds.qfRound_id" = '11';

-- Verify the update
SELECT "qfRound_id", "qfRound_allocatedFundUSD", "qfRound_name" 
FROM bronze_giveth_qf_rounds;
```


For Privote:

Grant Pools: Complete registry data with poll details

Projects: All recipients with metadata and payout info

Applications: Both claims (funded) and requests (application history)

Voting Data: Tally results + individual votes

Funding: Deposits and distribution amounts

Users: Voter accounts and credit balances

System: MACI configuration and stats

DAOIP-5 Ready Data:
Grant Pools → registries + poll data

Projects → recipients with metadata

Applications → claims (funded) + requests (all applications)

Funding → deposits + claims.amount

Voting → tallyResults + votes