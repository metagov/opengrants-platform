# TODOS

## Upgrade Airtable webhook from cursor polling to push-based notifications
**What:** When Dagster is publicly accessible, switch the Airtable sensor from cursor polling to push-based `notificationUrl` webhooks for near-instant pipeline triggers.
**Why:** Eliminates polling overhead (~30-60s latency) and reduces unnecessary API calls.
**Pros:** Near-instant response to Airtable changes, more efficient resource usage.
**Cons:** Requires publicly accessible Dagster URL, webhook verification endpoint, security hardening (HMAC signature validation).
**Context:** The current sensor polls the Airtable webhook cursor every 30-60 seconds. Airtable supports specifying a `notificationUrl` when creating webhooks — this would push change notifications directly to Dagster. Blocked until Dagster has a stable public URL (e.g., behind a reverse proxy with auth).
**Depends on:** Dagster deployment having a public URL with HTTPS.
**Added:** 2026-03-21

## Extract YAML schema lambda transforms into reusable helpers
**What:** Replace duplicated inline lambdas in YAML schema maps (e.g., currency parsing `float(v.replace('$','').replace('USD','').replace(',','').strip())`) with references to shared Python helper functions.
**Why:** The same currency/integer/boolean parsing lambdas are duplicated 6+ times per schema map. If the data format changes, every instance needs updating — risk of inconsistent fixes and silent drift.
**Pros:** Single source of truth for transform logic. Transforms become independently testable. Easier to add new schema maps.
**Cons:** Changes the YAML schema pattern used across all data sources (SCF, Giveth, GrantsStack, Privote). Requires deciding on an import/reference mechanism for YAML transforms.
**Context:** Identified during eng review of SCF Airtable migration. This is a cross-cutting refactor — should cover all schema maps at once, not just SCF, to avoid inconsistency.
**Depends on:** Nothing — can be done independently.
**Added:** 2026-03-21
