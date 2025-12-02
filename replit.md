# Overview

OpenGrants is a comprehensive data analytics platform that aggregates, normalizes, and visualizes grant funding data from multiple Web3 grant systems (Giveth, Stellar Community Fund, and Privote). The platform implements a medallion architecture (Bronze-Silver-Gold) for data quality and provides interactive dashboards for ecosystem-wide analytics.

The system ingests data from diverse sources (GraphQL APIs, CSV files, on-chain smart contracts), transforms it into a standardized DAOIP-5 schema, and surfaces insights through a Next.js dashboard backed by PostgreSQL and DuckDB databases.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Data Pipeline Architecture

### Medallion Layer Design
The platform uses a three-tier medallion architecture for progressive data refinement:

**Bronze Layer (Raw Ingestion)**
- Direct data capture from source systems without transformation
- Sources: Giveth GraphQL API, SCF CSV files, Privote on-chain data (Arbitrum)
- Storage: PostgreSQL tables prefixed with `bronze_`
- Tools: DLT (Data Load Tool) for extraction, Dagster for orchestration
- Rationale: Preserves original data for auditability and reprocessing

**Silver Layer (Normalized)**
- Transforms bronze data into standardized DAOIP-5 schema
- YAML-based schema mapping configuration for field transformations
- Storage: PostgreSQL tables prefixed with `silver_`
- Tools: Custom Python transformation utilities, Polars for data manipulation
- Rationale: Enables cross-platform comparison through consistent schema

**Gold Layer (Analytics)**
- Computed metrics, aggregations, and cross-platform insights
- Storage: PostgreSQL (primary), DuckDB (dashboard cache)
- Tools: dbt (data build tool) for SQL transformations
- Rationale: Optimizes query performance for dashboard consumption

### Orchestration Strategy
- **Dagster** manages entire pipeline lifecycle (scheduling, dependencies, monitoring)
- Assets organized by layer (bronze/silver) and source system (giveth/scf/privote)
- Jobs defined per source system for independent refresh cycles
- Resource pooling for database connections to prevent exhaustion

### Data Source Patterns

**GraphQL Sources (Giveth, Privote)**
- Pagination-based extraction with rate limiting
- Metadata enrichment via HTTP requests to IPFS/external URLs
- JSON flattening for nested structures
- Error handling for malformed metadata

**CSV Sources (SCF)**
- File-based ingestion from configurable directory paths
- Glob pattern escaping for special characters in filenames
- Pandas/Polars hybrid approach for type safety

**On-Chain Sources (Privote)**
- Web3.py integration for Ethereum contract reads
- ABI-based contract interaction for recipient registry
- Fallback mechanisms for RPC failures

## Frontend Architecture

### Technology Stack
- **Next.js 16** (Pages Router) for server-side rendering and API routes
- **Chakra UI v3** (@chakra-ui/react ^3.30.0) for component library (CLI-generated snippets)
- **React 19** with latest hooks and concurrent features
- **Framer Motion 11** for animations
- **next-themes 0.4.6** for theme management (light mode only)
- **Emotion 11.14.0** for CSS-in-JS styling

### Design Decisions
- Light mode only (no dark mode support) with forcedTheme="light"
- Burgundy (#800020) primary brand color for "OpenGrants" identity
- TypeScript for type safety with lenient `strict: false` configuration
- CLI-generated Chakra UI provider components in `src/components/ui/`
- API routes as database abstraction layer (prevents direct DB access from client)
- Component-based architecture with reusable MetricCard, SystemHeader, Navigation

### Chakra UI v3 Migration Notes
- Uses CLI-generated snippets: `npx @chakra-ui/cli@latest snippet add provider color-mode`
- No useColorModeValue (removed in v3) - use hard-coded light mode colors
- Updated spacing prop to gap (v3 syntax)
- suppressHydrationWarning in _document.tsx prevents Next.js/next-themes conflicts

### Page Structure
- `/` - Landing page with ecosystem overview
- `/ecosystem` - Cross-platform analytics
- `/system/giveth|scf|privote` - Platform-specific deep dives
- `/api/*` - Database query endpoints returning JSON

### Data Flow
1. Client requests page → Next.js SSR/CSR
2. `useSWR` hook fetches from `/api/*` endpoints
3. API routes execute PostgreSQL queries via connection pool
4. Data transformed to chart-friendly format in `lib/chartData.tsx`
5. Chakra Charts render visualizations

## Database Architecture

### Dual Database Strategy
**PostgreSQL (Primary)**
- All bronze/silver layer data storage
- Source of truth for dbt transformations
- Connection pooling via `pg` module
- Schema: Public (default) + `privote` namespace for contract data

**DuckDB (Analytics Cache)**
- Fast analytical queries for dashboard
- Synchronized from PostgreSQL via dbt macros
- File-based storage at `duckdb/data/local.duckdb`
- Rationale: Columnar storage optimizes aggregation queries

### Schema Conventions
- `bronze_*` - Raw ingested data
- `silver_*` - DAOIP-5 normalized tables
- `gold_*` - Aggregated metrics and insights
- `ui_*` - Dashboard-optimized views (Privote allocations)

### View Management
- Dependent views dropped before table replacement to avoid conflicts
- Mapping maintained in `utils/db.py` for automatic cascade drops
- Safety mechanism prevents "view depends on table" errors

# External Dependencies

## Third-Party Services

**Data Sources**
- **Giveth GraphQL API** (`https://mainnet.serve.giveth.io/graphql`) - QF rounds and project metadata
- **Privote Subgraph** (`MACI_GRAPHQL_ENDPOINT` env var) - On-chain voting data
- **Alchemy RPC** (Arbitrum Mainnet) - Smart contract reads for Privote recipient registry
- **IPFS Gateways** - Metadata resolution for project details

**Infrastructure**
- **DigitalOcean** - Hosting for Postgres Droplet and App Platform (Next.js)
- **Docker** - Containerization for Dagster, dbt, PostgreSQL
- **GitHub Actions** - CI/CD pipeline for build/test/deploy

## Core Libraries

**Python Stack**
- `dagster` + `dagster-webserver` - Pipeline orchestration
- `dlt` - Data ingestion framework
- `dbt-core` + `dbt-postgres` - SQL transformations
- `polars` - High-performance dataframes (preferred over pandas for memory efficiency)
- `sqlalchemy` + `psycopg2-binary` - Database connectivity
- `web3` - Ethereum contract interaction
- `yamale` - YAML schema validation for mapping configs

**JavaScript/TypeScript Stack**
- `next` - React framework (latest version)
- `@chakra-ui/react` - Component library
- `swr` - Data fetching hooks
- `recharts` - Charting library
- `pg` - PostgreSQL client
- `react-markdown` - Markdown rendering (for documentation pages)

## Configuration Management
- `.env` files for environment-specific secrets (DB credentials, API keys)
- YAML files in `configs/schema_maps/active/` for field mappings (DAOIP-5 transformations)
- Docker Compose for service orchestration (Postgres, Dagster, dbt containers)
- Next.js environment variables for runtime configuration

## API Contracts
- **DAOIP-5 Schema** - DAO metadata standard from Metagov (GitHub: metagov/daostar)
- **GraphQL** - Query language for Giveth/Privote APIs
- **ERC-20/Contract ABIs** - For on-chain data extraction