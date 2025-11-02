### Commands 
1. ```docker compose build dagster```

2. ```docker compose up dagster```

3. ```docker compose --verbose up dagster```

4. ```docker compose restart dagster```

psql:
1. ```docker exec -it postgres psql -U postgres -d opengrants```
5. `\dt bronze_*`

\c opengrants;
\d bronze_giveth_qf_rounds;
\d bronze_giveth_projects;



| Layer      | Folder                 | Example Asset                                     | Depends On            | Destination Table |
| ---------- | ---------------------- | ------------------------------------------------- | --------------------- | ----------------- |
| 🟤 Bronze  | `ops/`                 | `fetch_giveth_data`                               | —                     | `bronze_giveth_*` |
| ⚪ Silver   | `assets/silver/`       | `silver_giveth_projects` / `silver_giveth_rounds` | Bronze outputs        | `silver_daoip5_*` |
| 🟡 Configs | `configs/schema_maps/` | YAML field mappings                               | Used by Silver assets | —                 |



UPDATE bronze_giveth_qf_rounds
SET "allocatedFundUSD" = 127350 
WHERE id = '11';

| Layer            | Source                                | Refreshed By    | Used For            |
| ---------------- | ------------------------------------- | --------------- | ------------------- |
| **Silver**       | Postgres                              | Dagster         | Raw normalized data |
| **Silver Cache** | DuckDB                                | Dagster sync op | Fast dashboards     |
| **Gold**         | Postgres                              | dbt             | Aggregated metrics  |
| **Gold Cache**   | DuckDB                                | dbt macro       | Ecosystem stats     |
| **Dashboard**    | DuckDB (primary), Postgres (fallback) | —               | User interface      |
