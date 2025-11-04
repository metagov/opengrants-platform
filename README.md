# OpenGrants Data Platform — Developer Guide

This document explains the architecture, local development setup, and design principles for the OpenGrants monorepo.

---

##  Architecture Summary

The OpenGrants platform integrates multi-source data ingestion, transformation, orchestration, and visualization — hosted entirely on **DigitalOcean**.

### 🧩 Components

| Layer | Tool | Purpose |
|-------|------|----------|
| Ingestion | [DLT](https://dlthub.com) | Load data from APIs, CSVs, Airtable, or custom scripts |
| Storage | PostgreSQL + DuckDB | Bronze/Silver layers in Postgres; Gold in DuckDB |
| Transformation | [DBT](https://www.getdbt.com) | SQL models for cleaning + aggregations |
| Orchestration | [Dagster](https://dagster.io) | Pipeline scheduling, lineage, monitoring |
| Frontend | [Next.js](https://nextjs.org) | Interactive analytics dashboard |
| Hosting | DigitalOcean | Unified stack on Droplet + App Platform |
| CI/CD | GitHub Actions | Build → Test → Deploy to DO |

---

##  Medallion Architecture

The **Medallion (Bronze–Silver–Gold)** model structures our data pipeline into 3 progressive layers:

###  Bronze — *Raw Data Layer*
- Direct ingestion from source APIs, CSVs, or Airtable.
- Stored in Postgres as raw tables.
- No cleaning or normalization.
- Examples: `bronze_gitcoin_rounds`, `bronze_giveth_projects`.

### Silver — *Cleaned & Normalized Layer*
- Transformations that standardize schema into [DAOIP-5](https://github.com/metagov/daostar) format.
- Enforce typing, relationships, and metadata quality.
- Stored in Postgres.

### Gold — *Analytics & Aggregates Layer*
- Computed metrics and cross-ecosystem aggregates.
- Stored in DuckDB for fast querying and dashboard integration.
- Examples: funding trends, grant round stats, ecosystem funding distributions.

```

```
      ┌──────────┐
      │  Bronze  │  ← raw API / CSV / Airtable data (Postgresql)
      └────┬─────┘
           │
           ▼
      ┌──────────┐
      │  Silver  │  ← cleaned + normalized DAOIP-5 schema (Postgresql)
      └────┬─────┘
           │
           ▼
      ┌──────────┐
      │   Gold   │  ← analytics-ready data (DuckDB)
      └──────────┘
```

````

---

## Local Development Setup

### 1. Prerequisites
- Docker Engine ≥ 20.10
- Python ≥ 3.12
- Node.js ≥ 20 (for frontend)
- GitHub CLI (optional)

### 2. Clone & Setup
```bash
git clone <repo-url>
cd opengrants-platform
cp .env.example .env
````

### 3. Build Containers

```bash
docker compose build
```

### 4. Start Stack

```bash
docker compose up -d
```

Visit **Dagster UI** at → [http://localhost:3000](http://localhost:3000)

---

## Service Overview

| Service            | Port | Description                                   |
| ------------------ | ---- | --------------------------------------------- |
| `postgres`         | 5432 | Internal data warehouse                       |
| `dagster`          | 3000 | Dagster web UI + job scheduler                |
| `dlt`              | —    | DLT loader container (runs ingestion scripts) |
| `dbt`              | —    | Transformation container (runs `dbt run`)     |
| `nextjs-dashboard` | 8080 | Frontend (to be added later)                  |

---

##  CI/CD Strategy [Work in progress]

GitHub Actions automates:

1. Build + push Docker images to DigitalOcean registry
2. Redeploy Droplet stack via SSH
3. Deploy frontend via DigitalOcean App Platform

---

##  Roadmap (Status: Phase 1)

| Phase | Goal                                              |
| ----- | ------------------------------------------------- |
| 1     | Local Docker stack working (DLT → DBT → Dagster)  |
| 2     | Connect DigitalOcean Managed PostgreSQL           |
| 3     | Deploy on DigitalOcean Droplet                    |
| 4     | Add Next.js dashboard with live DuckDB queries    |
| 5     | Integrate LLM-powered query layer (Ask your data) |

---


## 🧩 References

* [DLT Docs](https://dlthub.com/docs)
* [DBT Docs](https://docs.getdbt.com)
* [Dagster Docs](https://docs.dagster.io)
* [DuckDB Docs](https://duckdb.org/docs)
* [DAOIP-5 Grants Metadata](https://github.com/metagov/daostar)
* [Docker Install on WSL Tutorial](https://daniel.es/blog/how-to-install-docker-in-wsl-without-docker-desktop/)


```

##### Contact: rashmi@metagov.org
ipelines`

