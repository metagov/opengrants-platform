# TODOS

## Upgrade Airtable webhook from cursor polling to push-based notifications
**What:** When Dagster is publicly accessible, switch the Airtable sensor from cursor polling to push-based `notificationUrl` webhooks for near-instant pipeline triggers.
**Why:** Eliminates polling overhead (~30-60s latency) and reduces unnecessary API calls.
**Pros:** Near-instant response to Airtable changes, more efficient resource usage.
**Cons:** Requires publicly accessible Dagster URL, webhook verification endpoint, security hardening (HMAC signature validation).
**Context:** The current sensor polls the Airtable webhook cursor every 30-60 seconds. Airtable supports specifying a `notificationUrl` when creating webhooks — this would push change notifications directly to Dagster. Blocked until Dagster has a stable public URL (e.g., behind a reverse proxy with auth).
**Depends on:** Dagster deployment having a public URL with HTTPS.
**Added:** 2026-03-21

## Fix silver type inconsistencies across platforms so gold doesn't need normalizing casts
**What:** Ensure silver tables emit consistent native Postgres types for shared fields (`isOpen`, `totalGrantPoolSizeInUSD`, `fundsApprovedInUSD`, etc.) so gold UNION queries don't require explicit `::boolean`/`::numeric` casts to avoid "UNION types X and Y cannot be matched" errors.
**Why:** Current workaround (casts in gold SQL) papers over the real issue: silver tables produce different native types for the same logical field depending on the platform (e.g. `isOpen` is `boolean` for Giveth/Privote but `text` for SCF). This caused a production outage (2026-03-28) when casts were mistakenly removed as "redundant".
**Pros:** Gold SQL becomes genuinely redundant-cast-free. Type mismatches caught at silver layer where they belong. Audit script (`audit_type_translations.py`) MISMATCH flags would go to zero.
**Cons:** Requires touching silver transform logic for each platform. Must run audit script to verify no regressions.
**Context:** The `source:null` fix (2026-03-27) correctly wires up null fields, but some non-null fields still land as `text` due to missing or broken lambda transforms in the YAML schema maps. Root cause verified via `DagsterDbtCliRuntimeError` in prod on 2026-03-28.
**Depends on:** `Extract YAML schema lambda transforms into reusable helpers` (related but not blocking).
**Added:** 2026-03-28

## Extract YAML schema lambda transforms into reusable helpers
**What:** Replace duplicated inline lambdas in YAML schema maps (e.g., currency parsing `float(v.replace('$','').replace('USD','').replace(',','').strip())`) with references to shared Python helper functions.
**Why:** The same currency/integer/boolean parsing lambdas are duplicated 6+ times per schema map. If the data format changes, every instance needs updating — risk of inconsistent fixes and silent drift.
**Pros:** Single source of truth for transform logic. Transforms become independently testable. Easier to add new schema maps.
**Cons:** Changes the YAML schema pattern used across all data sources (SCF, Giveth, GrantsStack, Privote). Requires deciding on an import/reference mechanism for YAML transforms.
**Context:** Identified during eng review of SCF Airtable migration. This is a cross-cutting refactor — should cover all schema maps at once, not just SCF, to avoid inconsistency.
**Depends on:** Nothing — can be done independently.
**Added:** 2026-03-21


## Add a Grants System Init Json/yaml file to source the initial Grant system data like url for extensions and also which funind mechanism

## Pre-deploy schema-mismatch tests for nextjs-dashboard API handlers
**What:** Add automated checks that run before code reaches prod, in two tiers:
  1. **Pre-push smoke script** (`nextjs-dashboard/scripts/predeploy.sh`) — boots `yarn dev` against the prod DB and curls every `/api/systems/*` endpoint, fails the push on any non-200. Wire to a git pre-push hook.
  2. **Schema introspection test** (`nextjs-dashboard/scripts/check-schema.ts`) — statically extracts every quoted column reference (`"x.y.z"` patterns) from `pages/api/**/*.ts`, queries `information_schema.columns` against `DATABASE_URL`, fails with a diff if any referenced column is missing.
  3. **Optional GitHub Action** (`.github/workflows/check.yml`) — runs both on PR using a read-only DATABASE_URL secret.
**Why:** Commit `ddcd9ca` (SCF bronze→Airtable migration) renamed silver column namespace from `io.scf.*` to `org.stellar.communityfund.*`. The Next.js API at `pages/api/systems/scf/[roundNumber].ts` was missed during the rename and silently returned HTTP 500 in prod for every existing SCF round (rendered as "Round not found" in the UI). Bug shipped 2026-03-21 and was only caught 2026-05-04 because no test runs against the actual schema.
**Pros:** Catches the entire class of column/table renames before deploy. Cheap (Tier 1 is a 30-min one-time setup; Tier 2 is one file). No staging environment needed — leverages the fact that local dev already points at the prod DB per `.env.example`.
**Cons:** Tier 3 needs a read-only Postgres role on DigitalOcean and a GitHub secret. Tier 1 requires every dev to enable the git hook locally.
**Context:** Discovered during root-cause investigation of the SCF round-page 404s. Same risk applies to all `/api/systems/*` handlers — gitcoin, ens, giveth, privote — any future silver-table migration could break them silently. The error handler in `lib/db.tsx` and `[roundNumber].ts` was hardened in the same fix to surface PG error codes (42703 → HTTP 503) so the next slip-through is at least visible from `curl`.
**Depends on:** Nothing — can be done independently. Tier 3 depends on having a read-only DB role.
**Added:** 2026-05-04
