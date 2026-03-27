# og_dagster/scripts

Utility scripts for auditing, debugging, and maintaining the pipeline outside of Dagster.

---

## audit_schema_coverage.py

Audits bronze→silver schema coverage. Connects to Postgres, reads every bronze table's
columns, and compares them against the `source:` fields in the active schema maps
(`og_dagster/configs/schema_maps/active/*.yaml`). Reports unmapped columns and overall
coverage percentage per section.

### When to run

- After adding new bronze columns (e.g. the upstream API added a field)
- After writing or editing a schema map YAML
- Before merging a silver pipeline change, to confirm no columns were accidentally dropped

### Usage

**Against local Docker Postgres** (port-forwarded to 5433):

```bash
POSTGRES_HOST=localhost POSTGRES_PORT=5433 DATABASE_URL="" \
  python3 og_dagster/scripts/audit_schema_coverage.py
```

`DATABASE_URL=""` overrides any `.env` that might point at production.

**Against a remote Postgres** (e.g. DigitalOcean Managed Postgres):

```bash
DATABASE_URL="postgresql://doadmin:<password>@<host>:25060/opengrants?sslmode=require" \
  python3 og_dagster/scripts/audit_schema_coverage.py
```

### Output

```
════════════════════════════════════════════════════════════
Schema: daoip5_scf.yaml
════════════════════════════════════════════════════════════

  ✅ [projects] → bronze_scf_projects
     Coverage: 27/27 columns (100.0%)

  ❌ [grant_pools] → bronze_scf_rounds
     Coverage: 33/36 columns (91.7%)
     Unmapped bronze columns (3):
       - some_new_field
       - another_field
       - yet_another
```

Exit code `0` = all columns mapped. Exit code `1` = gaps found (useful in CI).

### Fixing gaps

For each unmapped column, add an entry to the relevant section in the YAML schema map
under `extensions.<namespace>`:

```yaml
extensions:
  io.scf:
    someNewField:
      source: some_new_field
      type: string
      required: false
```

Re-run the script to confirm coverage returns to 100%.
