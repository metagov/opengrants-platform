# SCF Data Impact Assessment and Backup Plan

**Date:** 2026-10-10
**Scope:** SCF data in the OpenGrants datalake: bronze, silver and gold tables, plus the DAOIP-5 IDs
other systems depend on (the SCF project pages' `canonical_id`, PG Atlas, Gateway API and MCP
consumers).
**Trigger:** SCF now uses OpenGrants DAOIP-5 IDs as `canonical_id`
([SCF#143](https://github.com/SCF-Public-Goods-Maintenance/scf-public-goods-maintenance.github.io/issues/143)),
and changes to how IDs are assigned are planned in #4. Before any of that rewrites data, we need
to know what can be lost and have a way back.

Related: [ID instability investigation](scf_canonical_id_data_loss_report_2026-10-09.md), #3, #4.

---

## Summary

- **Today, the pipeline keeps no history.** Every run drops and rewrites bronze (raw Airtable),
  fully replaces silver, and rebuilds the dbt gold tables. The only past states are two CSV
  exports committed by hand (Nov 2025, Feb 2026) and one on Drive (Jul 2025). That is why 9 renamed
  or merged project IDs, and $780K of their award history, could only be reconstructed by diffing
  those files.
- **The changes in #3 add no new loss, but make the existing exposure larger.** The sensor now
  also fires on edits, so overwrites happen more often.
- **The planned ID registry (#4) is the highest-impact change.** It will re-key IDs that external
  systems store. It must not start before the backups below are in place.
- **Added in this PR:** an append-only archive built into the pipeline. Every distinct bronze
  payload is stored before it is overwritten, along with every DAOIP-5 ID ever published. If the
  archive write fails, the overwrite does not happen. There is also a script to list, export and
  restore archived snapshots. Tested end to end; see [Verification](#verification).

## 1. What the pipeline overwrites today

| Layer | Tables | How each run writes | History kept | Notes |
| --- | --- | --- | --- | --- |
| Bronze | `bronze_scf_projects`, `bronze_scf_submissions`, `bronze_scf_rounds` | `DROP TABLE … CASCADE`, then write the new copy | **None** | `_airtable_id` (Airtable's record ID) is dropped before writing, so the one key that survives renames is never stored. The table is dropped *before* the new copy is written: if the write fails, bronze is empty until the next successful run. |
| Silver | `silver_scf_projects`, `silver_scf_grant_applications`, `silver_scf_grant_pools` | `if_table_exists="replace"` | **None** | IDs are rebuilt from Airtable names on every run, so a rename silently replaces the ID (see the investigation report). |
| Gold | dbt models, e.g. `gold__scf_system_profile` | Rebuilt by dbt (tables and views) | **None** | Derived from silver, so it can always be rebuilt if silver can. |
| Metadata | `platform_metadata` | Upsert | Latest only | — |
| Snapshots | `raw_data/SCF/*` | Committed by hand | Nov 2025, Feb 2026 (plus Jul 2025 on Drive) | Taken irregularly. Production has read Airtable live since March 2026, so nothing in between was kept. |

**Database-level backups:** DigitalOcean managed Postgres takes daily automatic backups with a
limited retention window. That retention has **not been verified** for this cluster. It protects
against losing the database, not against a bad pipeline run silently overwriting good data,
which is the risk here.

## 2. Impact of each change

| Change | Where | Tables and columns affected | Consumers affected | Data lost? | Reversible? | Risk |
| --- | --- | --- | --- | --- | --- | --- |
| `createdAt` taken from Airtable `createdTime` | #3 | Bronze gains `_airtable_created_time`; silver `createdAt` changes from a fake `2025-01-01` to the real timestamp, or null | Gateway API `createdAt` field; DAOIP-5 compliance | No. Replaces a fabricated constant. | Yes (revert the mapping) | Low |
| Sensor also fires on record edits, and fingerprints every record ID | #3 | No schema change; more pipeline runs | None directly | **Before this PR, yes:** each extra run overwrites bronze and silver with no history. **With the archive, no.** | n/a | Medium without the archive, low with it |
| Project pages and APIs (`/system/scf/project/*`, `/api/systems/scf/projects`) | #3 | Read-only | Dashboard users, PG intake reviewers | No | Yes | Low |
| Round API adds `daoip5_project_id` | #3 | Read-only, additive | Round page | No | Yes | Low |
| Pipeline archive (this change) | #3 | New tables `archive_scf_bronze_snapshots`, `archive_scf_published_ids` | None (write-only) | No. It is what prevents loss. | Yes (drop the tables) | Low (storage, see §4) |
| Gateway `grantApplications` fix (`projectId` alone no longer limited to one round) | Grants-Gateway-API#6 | Read-only | API and MCP users | No. Returns rows that were wrongly hidden. | Yes | Low |
| **ID registry and re-keying on the earliest published ID** | #4 (planned) | Silver `id`, `projectId`, and the application IDs; new registry and alias tables | **SCF project pages' `canonical_id`, PG Atlas, API and MCP users, dashboard URLs** | Possible if done without history: the earliest IDs can only be known from archived state | Only with backups and an alias table | **High** |
| SCF `canonical_id` adoption | SCF repo (#138) | None on our side | SCF pages, genesis/intake flow | No, but 13 of 20 IDs don't resolve in our data today | n/a | Medium (link breakage) |

## 3. Backups added in this change

### 3.1 Pipeline archive (automatic, every run)
`og_dagster/utils/scf_archive.py`, wired into the bronze and silver SCF assets.

- **`archive_scf_bronze_snapshots`.** Before each bronze table is dropped, the full Airtable
  payload is stored as JSON, **including `_airtable_id`**, with the run ID, record count and a
  SHA-256 of the content.
  - An identical payload is skipped, so storage only grows when Airtable data actually changes.
  - **Fail-closed:** if the archive write fails, the run aborts *before* bronze is dropped.
- **`archive_scf_published_ids`.** After each silver table is written, every DAOIP-5 ID it
  published is upserted with the name it was first published under, `first_seen_at` and
  `last_seen_at`.
  - IDs that vanish keep their row. This is the record of "every ID ever published" that re-keying
    in #4 needs.
  - An ID whose `last_seen_at` is older than the latest run has vanished from silver, so a query on
    that column flags renames as they happen.

### 3.2 Restore and export
`scripts/scf_archive_restore.py` (read-only database access is enough for `--list` and `--export`):

```bash
python3 scripts/scf_archive_restore.py --list
python3 scripts/scf_archive_restore.py --export raw_data/SCF/10_October_2026 --at 2026-10-10T12:00
python3 scripts/scf_archive_restore.py --restore --at 2026-10-10T12:00             # writes bronze_scf_*_restored
python3 scripts/scf_archive_restore.py --restore --in-place --at 2026-10-10T12:00  # then re-run silver
```

`--export` writes CSVs in the same layout as `raw_data/SCF/`, so `scf_id_audit.py` and
`scf_intelligence_report.py --snapshot` work on any past state.

### 3.3 Still to do (needs access I don't have from this environment)
1. **Before starting the #4 migration**, take a one-off full dump of SCF bronze, silver and archive
   tables and keep it outside the database (DigitalOcean Spaces, or an encrypted file kept by the
   maintainer):
   ```bash
   pg_dump "$DATABASE_URL" --no-owner -t 'bronze_scf_*' -t 'silver_scf_*' -t 'archive_scf_*' \
     -t platform_metadata -Fc -f scf_pre_registry_$(date +%F).dump
   ```
   The read-only `report_reader` role can run this, because it only needs `SELECT`.
2. **Confirm the DigitalOcean backup retention** for `opengrants-db`, and enable point-in-time
   recovery if the plan allows it.
3. **Keep an offsite copy of the archive.** The archive lives in the same database it protects.
   Export it monthly (`--export`) to Spaces or a release artifact. It's about 2 MB per full
   snapshot gzipped.
4. **Seed `archive_scf_published_ids` with history.** Run the archive once over the committed
   Nov 2025 and Feb 2026 snapshots and the Jul 2025 export, so IDs published before this change
   are recorded too. The verification below shows this works.
5. **Ask PG Atlas for its ingested SCF ID list** (#4, question 3). That is the most complete record
   of IDs published before March 2026.

## 4. Storage and cost
- A full SCF snapshot is about **5.9 MB of JSON** (submissions 4.6 MB, projects 1.25 MB, rounds
  0.11 MB). Postgres compresses large text automatically, and gzip brings it to about 1.75 MB.
- Only tables whose content changed are archived. Even at 30 changes a month to the largest table,
  that's under 150 MB a month before compression.
- If that grows uncomfortable, a retention job can thin old snapshots to weekly after 90 days.
  Never delete a table's first snapshot of each quarter.

## 5. Residual risks
- **Bronze is dropped before it's written.** The archive means nothing is lost, but bronze can be
  empty if a write fails partway. Writing to a staging table and swapping it in would close that
  window; worth doing alongside #4.
- **The archive shares the production database.** Losing the database loses the archive too until
  §3.3 (3) is in place.
- **Silver and gold aren't archived directly.** They're rebuildable from archived bronze, given
  the schema map version used at the time, which is in git history.
- **IDs already lost before this change** (Mar–Oct 2026, when no snapshots were taken) can only be
  recovered from PG Atlas's ingested IDs or from Airtable revision history.

## Verification
I ran the real bronze and silver SCF assets against a local Postgres, with the Airtable fetch
stubbed to return committed snapshot data:

| Step | Result |
| --- | --- |
| Run 1: Nov 2025 data | 3 bronze snapshots archived (537 / 734 / 41 records); IDs recorded |
| Run 2: Feb 2026 data | 3 new snapshots (579 / 758 / 48); silver overwritten as in production |
| Run 3: Feb 2026 data again | **0 new snapshots** (identical content skipped) |
| Published-ID archive after run 2 | 588 project, 584 application and 48 grant pool IDs. **All 9 project IDs that vanished between Nov and Feb are kept**, with their original names (`rampmedaddy`, `solidity_contracts_on_soroban`, `leaf_global_fintech`, …) |
| Restore the Nov snapshot (`--export`, `--restore`) | Row-for-row identical to the original Nov 2025 export for all three tables |
| Unit tests (`og_dagster/tests/test_scf_archive.py`) | Pass, as part of 39 passed (11 skipped; these need live Airtable) |
