# Use your main Postgres for production runs
dbt run --target dev_postgres

# Use DuckDB for local analytics / dashboards
dbt run --target dev_duckdb



duckdb dbt_project/local.duckdb
D SHOW TABLES;
D SELECT * FROM gold__funding_metrics LIMIT 10;


### Main Commands

- docker compose build dbt 
- docker compose run dbt run
- docker compose run dbt list --resource-type source
