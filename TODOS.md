# TODOS

## [IMPORTANT, before Q3 submissions] Fix "paid exceeds award" on Tansu and the other affected SCF projects
**What:** The Tansu project page (`/system/scf/project/tansu_-_soroban_versioning`) shows the "Paid exceeds award in source data" flag: $246,720 paid against $147,360 awarded (167%). The excess is all in the SCF #30 award: $198,720 paid against $99,360 awarded, exactly double, so the payment looks double-counted in the SDF Airtable. Across SCF, 36 applications show more paid than awarded, $1.12M over in total.
  1. List all 36 affected rows (the accuracy gate reports them under `paid_within_award`; or query `silver_scf_grant_applications` where `totalPaidUSD > fundsApprovedInUSD`).
  2. Confirm each with SDF against the Airtable payment records, starting with Tansu SCF #30.
  3. Fix it at the source (SDF corrects Airtable) where possible. Where it can't be fixed in time, cap displayed paid at awarded in the dashboard and API, show "paid figure under review", and document the correction.
  4. Re-run the pipeline and confirm the flag clears and the accuracy gate's `paid_within_award` warning count falls.
**Why:** Q3 deliverables, the SCF #42–#45 Intelligence Report and the project pages all cite paid totals. Submitting with a visibly wrong figure on a well-known project like Tansu undermines the data's credibility with reviewers and PG Atlas.
**Pros:** Accurate paid figures in the Q3 submission and the Intelligence Report; one of the open data-quality items with SDF closed.
**Cons:** Depends on SDF responding before the submission; the fallback (capping in the UI) hides rather than fixes the source error.
**Context:** Found while building the D4a project view (PR #3). The UI flag and the gate warning both already exist; this item is about correcting the numbers.
**Depends on:** SDF access to the Airtable payment records.
**Added:** 2026-10-10

## Optimize SCF sensor-triggered writes
**What:** Make each sensor-triggered SCF run write less:
  1. Skip the run, or stop after bronze, when the fetched Airtable content hash matches the latest archived snapshot (the archive already computes it).
  2. Write bronze to a staging table and swap it in, instead of `DROP … CASCADE` then write.
  3. Rebuild only the silver tables whose bronze inputs changed, and only rebuild the SCF gold models.
  4. Debounce bursts of edits (e.g. wait for a few minutes of no changes before running).
  5. Batch the published-ID upserts into one statement instead of one per row.
**Why:** Since the sensor also fires on record edits (PR #3), runs are more frequent. Each one drops and rewrites every SCF table and rebuilds all of gold, even when nothing relevant changed. That's wasted database load, a longer window where bronze is empty, and more churn for the dashboard and API.
**Pros:** Fewer writes and dbt builds, shorter empty-table windows, lower DB load and cost.
**Cons:** More moving parts in the sensor and assets. Needs tests for the skip and debounce logic.
**Context:** `og_dagster/sensors/scf_sensor.py`, `og_dagster/assets/bronze/scf.py`, `og_dagster/utils/scf_archive.py`. See `docs/data-quality/scf_data_impact_assessment_2026-10-10.md` §2 and §5.
**Depends on:** Nothing.
**Added:** 2026-10-10

## SCF data backup follow-ups (from the data impact assessment, §3.4)
**What:** The backups that need production access:
  1. **Before starting the #4 migration**, take a full `pg_dump` of SCF bronze, silver, archive and `platform_metadata` tables and keep it outside the database (DigitalOcean Spaces or an encrypted file kept by the maintainer). The read-only role can run it.
  2. **DigitalOcean point-in-time recovery: confirmed.** The cluster can restore to any transaction from the last 7 days. Nothing to enable. Bad data noticed after 7 days can only be recovered from the pipeline archive or an offsite dump.
  3. **Keep an offsite copy of the archive.** Export it monthly (`scripts/scf_archive_restore.py --export`) to Spaces or a release artifact. About 2 MB gzipped per full snapshot.
  4. **Seed `archive_scf_published_ids` with history** from the committed Nov 2025 and Feb 2026 snapshots and the Jul 2025 Drive export.
  5. **Ask PG Atlas for its ingested SCF ID list** (#4, question 3).
**Why:** The archive lives in the same database it protects, and DigitalOcean's 7-day window is too short to catch slow-to-notice overwrites.
**Pros:** A way back from any bad run or a failed #4 migration.
**Cons:** Item 3 needs a scheduled job or someone to remember it monthly.
**Context:** `docs/data-quality/scf_data_impact_assessment_2026-10-10.md` §3.4.
**Depends on:** Production DB access (read-only is enough for 1, 3 and 4).
**Added:** 2026-10-10

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

## Write an SCF maintenance and support protocol
**What:** A short runbook (`docs/scf_support_protocol.md`) for what OpenGrants does for SCF, and when. Each section should name an owner and a response time. It should cover:
  1. **Quarterly award cycle.** Q3 2026 dates for reference: deliverables due ~Oct 1, renewal PR ~Oct 7, D&R and community vote ~Oct 22. Deliverables go on a `deliverables/opengrants-<quarter>` branch; proposals on `proposals/opengrants-<quarter>`. Both edit only `docs/projects/opengrants.md` in the SCF repo. Include the maintenance/other budget split, and evidence dated inside the quarter.
  2. **Per-round data work.** When a round closes, confirm the sensor ingested it, then run the Intelligence Report (`scripts/scf_intelligence_report.py`) and post it before the vote. Regenerate DAOIP-5 compliance quarterly (`scripts/daoip5_compliance_check.py`, `scripts/daoip5_round_compliance.py`).
  3. **ID stewardship.** Follow issue #4: keep IDs stable, record aliases on renames and merges, adopt PG-minted `canonical_id`s, and answer intake lookups.
  4. **Downstream support.** PG Atlas (SBOM action, ID exports, schema changes), PG Maintenance intake reviewers, and MCP and API consumers. Say where requests arrive: SCF repo issues and PRs, the Q4 PG Discord thread, email.
  5. **Data-quality escalation to SDF.** Report what the pipeline can't fix: blank project links, paid > awarded (36 rows found in Oct 2026), renamed projects.
  6. **Operations.** Uptime via `health_endpoint` on the project page, alerts on failed runs, read-only DB access for reports, credential rotation.
  7. **Contacts.** Who is tagged on SCF threads: Anke currently tags @sam-mccarthy07, but Rashmi does the submissions.
**Why:** In Q3 we missed the deliverables and proposal deadlines, found the ID-loss problem only after SCF raised it, and reconstructed the process from emails and PR comments. A written protocol makes this repeatable, and doubles as the maintenance reserve plan reviewers now ask for.
**Pros:** Fewer missed deadlines, faster responses to PG Atlas and PG Maintenance, and quarterly reports that are cheap to write.
**Cons:** Needs a periodic refresh as SCF's process changes; it changed twice in Q3.
**Context:** Built from the Q3 2026 cycle: Anke's Oct 2 email and PR comments on SCF-Public-Goods-Maintenance PR #126, issue #143 (canonical IDs), and the proposer instructions at https://scf-public-goods-maintenance.github.io/pg-award/proposer-instructions/.
**Depends on:** Issue #4 (stable IDs) for section 3. Nothing else.
**Added:** 2026-10-10
