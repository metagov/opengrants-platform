# API Schemas

This directory stores API schemas and SDL (Schema Definition Language) files for reference when building bronze layer data extraction queries.

## Structure

```
api_schemas/
├── giveth/
│   └── schema.graphql     # Giveth GraphQL SDL
├── privote/
│   └── schema.graphql     # MACI/Privote subgraph SDL
├── scf/
│   └── (CSV schemas or API docs if applicable)
└── <new_source>/
    └── schema.graphql
```

## Purpose

- **Query generation**: Reference schemas to write optimal GraphQL queries
- **Field discovery**: Understand available fields and types before building extractors
- **Documentation**: Keep API contracts versioned alongside code
- **AI assistance**: Provide context for generating extraction code

## How to Add a New Schema

### For GraphQL APIs

1. Fetch the schema using introspection:
   ```bash
   # Using graphql-cli
   npx get-graphql-schema https://api.example.com/graphql > og_dagster/configs/api_schemas/<source>/schema.graphql

   # Or using curl
   curl -X POST https://api.example.com/graphql \
     -H "Content-Type: application/json" \
     -d '{"query": "{ __schema { types { name fields { name type { name } } } } }"}' \
     | jq '.data.__schema' > og_dagster/configs/api_schemas/<source>/schema.json
   ```

2. For The Graph subgraphs, you can also find schemas at:
   - Subgraph explorer: `https://thegraph.com/explorer/subgraph/<org>/<name>`
   - Or in the subgraph's GitHub repo under `schema.graphql`

### For REST APIs

Store OpenAPI/Swagger specs as `openapi.yaml` or `openapi.json`.

## Current Sources

| Source | Type | Schema Location | API Endpoint |
|--------|------|-----------------|--------------|
| Giveth | GraphQL | `giveth/schema.graphql` | `mainnet.serve.giveth.io/graphql` |
| Privote | GraphQL (The Graph) | `privote/schema.graphql` | MACI subgraph |
| SCF | CSV | N/A | File-based ingestion |
