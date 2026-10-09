# SCF DAOIP-5 ID Stability and Data Loss Investigation

**Date:** 2026-10-09
**Scope:** Stellar Community Fund (SCF) data in OpenGrants — project and application IDs, and how
they join to the `canonical_id` values now used by the SCF Public Goods site and PG Atlas.
**Context:** [SCF-Public-Goods-Maintenance#143](https://github.com/SCF-Public-Goods-Maintenance/scf-public-goods-maintenance.github.io/issues/143),
[#138](https://github.com/SCF-Public-Goods-Maintenance/scf-public-goods-maintenance.github.io/pull/138)
**Reproduce:** `python3 scripts/scf_id_audit.py raw_data/SCF/11_November_2025 raw_data/SCF/23_February_2026 <canonical_ids.txt>`

---

## Summary

SCF now uses OpenGrants DAOIP-5 IDs as the `canonical_id` that joins a project's Public Goods page,
its PG Atlas record and its SCF funding history. OpenGrants did not treat those IDs as stable: it
re-derives them from the project **name** on every pipeline run and fully replaces the silver tables.
Any rename, merge or blank link in the SDF Airtable therefore changes or drops IDs without notice.

| Finding | Snapshot evidence | Impact |
| --- | --- | --- |
| IDs vanished between snapshots | **9** project IDs (Nov 2025 → Feb 2026) carrying **$780,327** in awards | Old IDs 404; history split or detached |
| Same submission, new application ID | **8** awarded submissions, **$692,327** | Joins on the old ID break |
| SCF `canonical_id`s that resolve in OpenGrants | **7 of 20** project pages | 13 pages show no SCF funding history |
| Awards not linked to any project | Nov 2025: **26** submissions, **$2,099,865**. Feb 2026: **2**, **$79,900** | Missing from project totals |
| Application IDs shared by several awards | **143** IDs cover **182** additional awards | 182 awards unreachable by ID; counts understated |
| IDs with URL-hostile characters | **117** of 579 (`/`, `"`, `\|`, `:`, `(`, `.`) | Fragile links and lookups |

No submission disappeared from the source: every Nov 2025 submission is still in the Feb 2026
export. The loss is in **identity and linkage**, not in raw award records, so it is recoverable.

## Sources and limitations

- **Analysed:** the two SDF Airtable snapshots committed to this repo —
  `raw_data/SCF/11_November_2025` (537 projects, 734 submissions, 41 rounds) and
  `raw_data/SCF/23_February_2026` (579 projects, 758 submissions, 48 rounds) — plus the 20
  `canonical_id` values in `docs/projects/*.md` of the SCF Public Goods site (2026-10-09).
- **Not analysed:**
  - The production database. The pipeline has read Airtable live since March 2026, so production
    may have drifted further.
  - The PG Atlas API, which this environment could not reach.
  - A July 2025 export on Drive (`Awarded Submissions [Build only]-By Round (5).csv`), which would
    extend the history back.
- ID derivation below is the exact transform in `og_dagster/configs/schema_maps/active/daoip5_scf.yaml`.

## How IDs are made today

```yaml
# projects.id                (source: Airtable "Title")
lambda v: f"daoip-5:scf:project:{v.strip().lower().replace(' ', '_')}"
# grant_applications.id      (source: Airtable "Submission / Project")
lambda v: f"daoip-5:scf:application:{v.strip().lower().replace(' ', '_')}"
```

- The ID **is** the name. There is no stored mapping from Airtable record to ID.
- `assets/silver/scf/scf.py` writes with `if_table_exists="replace"`, so the previous IDs are gone
  after each run and nothing records what they used to be.
- The application ID is derived from the **project** name, not from the submission, so a project's
  awards all share one application ID.

## Findings

### F1. Renames and merges in Airtable changed or removed 9 project IDs

| Old ID (Nov 2025) | Awarded | Now (Feb 2026) | Type |
| --- | ---: | --- | --- |
| `bousol_wallet` | $149,215 | `bousol_wallet_enterprise` | Rename |
| `fastbuka_delivery_-_food_and_grocery_app` | $70,000 | `choppaddi_-_food_and_grocery_app` | Rename (renamed at least 3 times per #143) |
| `leaf_global_fintech` | $249,112 | `boss_money_(former_leaf_global)` | Rename |
| `rampmedaddy` | $150,000 | `wellspring` | Rename |
| `reclaim_protocol` | $50,000 | `zkfetch:_zktls-powered_oracle_solution` ($166,000 total) | **Merge** into a project with other awards |
| `solidity_contracts_on_soroban` | $32,000 | `solang_playground` ($42,000 total) | **Merge** — this is hyperledger-solang's `canonical_id` |
| `ionize:_stellar_asset_bridge` | $30,000 | `transfuse:_multichain_asset_bridge` | **Merge** (was a two-project link) |
| `blend` | $50,000 | — | Dropped: Liquidity Award, outside the "Build only" view |
| `stella_lumi_media` | $0 | — | Dropped: no award |

Five were matched automatically by submission URL, which is stable across renames, and one
(FastBuka) by website. Ionize was traced through the application ID of its one submission. The three merges mean an old project's history now sits under a different, larger
project, so "the same project" is a judgement call, not a lookup.

### F2. 13 of the 20 SCF `canonical_id`s do not resolve in OpenGrants

| Status | Pages |
| --- | --- |
| Resolves (7) | `python_stellar_sdk`, `scout`, `soroban_security_portal`, `stellar_php_sdk`, `stellarchain.io`, `stellar_light`, `tansu_-_soroban_versioning` |
| **Broken by rename (1)** | `solidity_contracts_on_soroban` (hyperledger-solang) — existed Nov 2025, gone Feb 2026 |
| **Never in OpenGrants SCF data (12)** | `java_stellar_sdk`, `kmp_stellar_sdk`, `obsrvr_radar`, `opengrants`, `refractorspace`, `scaffold_stellar`, `soropg`, `flutter_stellar_sdk`, `stellar_hardware_wallet_support`, `stellar_ios_mac_sdk`, `.net_stellar_sdk`, `stellar_registry` |

The twelve "never present" IDs fall into two groups:

- **No Build award in the source.** These projects are funded through the PG Award or through
  programmes outside the Build-only Airtable views, which OpenGrants does not ingest. For them, the
  ID minted for the SCF page is the first and only ID, and OpenGrants has no record to attach it to.
- **Related Build history under other names, unlinked.** OBSRVR's Build awards are under
  "Horizon-as-a-Service" and "Flow". Soneso has "Flutter Wallet SDK" and "Swift Wallet SDK". Whether
  these are the same projects as `obsrvr_radar`, `flutter_stellar_sdk` and `stellar_ios_mac_sdk`
  needs a human decision. Left unlinked, the funding history is fragmented, which is the outcome
  #143 warns against.

**Prefix mismatch, needs checking.** The SCF pages use `daoip-5:scf:project:…`. The #143 thread
reports that PG Atlas resolves `daoip-5:scf:application:…`. Both namespaces exist in OpenGrants with
the same suffix, so consumers may be joining on different keys.

### F3. Application IDs are not unique

A project's awards share one application ID: **143** IDs stand for **182** additional awards
(for example `beans_app`, `reflector` and `orbitcdp` have 4 each). Effects:

- Gateway `GET /api/v1/grantApplications/:id` (`server/adapters/scf.ts`, `WHERE id = $1`) returns
  one row. The other 182 awards cannot be fetched by ID.
- The dashboard's Soroban adoption metric (`nextjs-dashboard/src/pages/api/systems/scf.ts`) uses
  `COUNT(DISTINCT a.id)` per quarter and under-counts **12** awards.
- This breaks DAOIP-5's one-ID-per-application model. Because external pages now store these
  strings, the IDs cannot be "fixed" in place (see Fix 4).

### F4. Awards not linked to any project

| Snapshot | Submissions with no matching project | Awarded |
| --- | ---: | ---: |
| Nov 2025 | 26 (24 blank Project links in SCF #34–#39, plus 2 multi-project links) | $2,099,865 |
| Feb 2026 | 2 | $79,900 |

The two remaining in Feb 2026:

- **`docking.zone`** (SCF #37, $75,000) — blank Project link in Airtable.
- **`Fixed Rate "Fixie"`** (SCF #21, $4,900) — the linked value arrives as `"Fixed Rate ""Fixie"""`
  (CSV quote escaping left in place), so it never matches the project title.

These rows get `projectId = NULL`. They count in round totals but not in any project's totals or
history.

### F5. Multi-project links produce invalid IDs

Airtable "Project" is a linked-record field and can hold several values. The transform turns
`Ionize: Stellar Asset Bridge, Transfuse: Multichain Asset Bridge` into the single ID
`ionize:_stellar_asset_bridge,_transfuse:_multichain_asset_bridge`, and `Alternun, Alternun` into
`alternun,_alternun`. Neither matches a project.

### F6. Name-derived IDs carry URL-hostile characters

117 of 579 project IDs contain characters outside `[a-z0-9_]`: colon (31), dot (32), parentheses
(16), pipe (2), slash (1: `greep_pos/_greep_pay`), double quote (1: `fixed_rate_"fixie"`). These must
be URL-encoded in every link and API path, and they will never equal SCF's
`_slug_to_canonical_suffix`, which keeps only `[a-z0-9_]`.

### F7. The pipeline has no memory

Full table replacement, no ID registry, no snapshot of past IDs, and no check comparing one run's
IDs with the last. Every finding above happened silently. Atlas, by contrast, never drops an ingested
ID (#143), so the two systems drift further apart with every Airtable edit.

## Who is affected

| Consumer | Effect |
| --- | --- |
| SCF Public Goods pages (`canonical_id`) | 13 of 20 show no funding history; hyperledger-solang's ID is broken |
| PG Atlas | Joins on renamed or never-present IDs fail; Atlas keeps the stale IDs |
| Gateway API users | Old IDs return 404; 182 awards unreachable by ID; no redirect or `replacedBy` |
| OpenGrants dashboard | Renamed projects lose their history; Soroban metric under-counts by 12; orphaned awards are missing from project views |
| Intelligence reports | Returning-applicant and per-project history miss renamed and merged projects unless matched by hand |

## Possible fixes

Ordered so that each step can ship on its own. Fixes 1–3 stop further loss; 4–6 repair the existing
damage; 7–10 are hygiene and monitoring.

### 1. Freeze IDs with a registry (stops further loss)

Add an append-only `scf_id_registry` table: `airtable_record_id → daoip5_id`, plus `first_seen`,
`source` (`opengrants` | `pg-maintenance` | `atlas`), and `status` (`active` | `alias` | `merged`).

- An ID is assigned once, on first sight, and never regenerated.
- The display name comes from the latest Airtable title and stays independent of the ID.
- The bronze layer already receives `_airtable_id` (Airtable record IDs survive renames), so this is
  a silver-layer change.

*Effort:* medium. *Risk:* low. Existing IDs stay as they are on the day the registry is seeded.

### 2. Seed the registry with the earliest published ID, and keep aliases

Follow @aolieman's suggestion in #143: re-key every project to the **earliest** ID it was published
under, and keep later IDs as aliases.

- Seed from the union of the PG Atlas ID list (Atlas never drops IDs), the Nov 2025 and Feb 2026
  snapshots, the July 2025 Drive export, and the current production table.
- The snapshots have no record IDs, so link old IDs to current records by submission URL and
  website, as this audit does (it resolved 6 of the 9 vanished IDs automatically), then have a
  person review the result.

*Effort:* medium. *Needs:* Atlas ID export; reviewer time for merges.

### 3. Serve aliases in the API

- `GET …/projects/{old_id}` returns 301 to the current ID, or the record with `replacedBy`.
- List endpoints accept either ID.

Old links from SCF pages, Atlas and the #41 report keep working.

*Effort:* small once Fix 1 exists.

### 4. Adopt the SCF `canonical_id`s and decide the twelve

| Group | Action |
| --- | --- |
| `solidity_contracts_on_soroban` | Keep as the registry ID for the Solang record; `solang_playground` becomes an alias. Confirm the merge with the Solang maintainers. |
| No SCF Build record | Register as `source = pg-maintenance` IDs with no funding rows. Attach PG Award data when deliverable 7 (PG Award integration) lands. |
| Possible related Build history (OBSRVR, Soneso) | Human decision with the project and Atlas: link as aliases, or keep separate. |
| Prefix | Agree with Atlas and PG Maintenance on one namespace for `canonical_id` (`project:` vs `application:`). Expose the other as an alias. |

### 5. Make application IDs unique without breaking stored IDs

Keep today's `application:<project>` strings exactly as they are, as frozen project-level keys,
because they are already stored externally. Add a new, unique per-award ID (for example
`daoip-5:scf:application:<airtable_record_id>`) for the real DAOIP-5 application record. Switch the
Gateway `:id` lookup and `COUNT(DISTINCT …)` metrics to the new ID. Announce on #143 before shipping.

### 6. Repair orphans and multi-links at ingest

- Split linked-record lists on `", "` before deriving `projectId`. Use the first linked project and
  log the rest, or keep all of them in an extension field.
- Strip CSV-escaped quotes (`""` → `"`, outer quotes removed) before matching linked names. This
  fixes Fixie.
- Fail the silver data-quality check, or at least alert, when an awarded submission has no
  `projectId`. Report blank links upstream to SDF (currently `docking.zone`, SCF #37).

### 7. One slug rule for new IDs

New IDs minted after the registry exists should use the same `[a-z0-9_]` rule as SCF's
`_slug_to_canonical_suffix`. Never re-slug existing IDs, because that would break them again. URL-encode
IDs everywhere they appear in paths and links.

### 8. Keep history

- Write silver with history (slowly-changing records), or at least append each run's ID list to a
  dated table.
- Keep the raw Airtable snapshots, so "what did ID X point to on date D" is answerable.

### 9. Guard rails in CI and the pipeline

- Run `scripts/scf_id_audit.py` on every pipeline run against the previous run's IDs.
- Alert on any vanished ID, new orphan award, or new shared application ID.
- Add the existing Python tests to CI (only the SBOM workflow runs today).

### 10. Verify against production before acting

Run this audit against the production silver tables and the Airtable API, and diff against the PG
Atlas ID list. That confirms which of the findings above are live today and how far production has
drifted since February.

## Recommended sequence

1. **This week:**
   - Run Fix 10 against production.
   - Share this report's findings on #143.
   - Agree the namespace and merge rules with PG Atlas and PG Maintenance.
2. **Next:** Fixes 1–3 (registry, seed, aliases). This is the stable-ID proposal committed on #143.
3. **Then:** Fix 4 (canonical_id adoption) and Fix 6 (orphans), followed by Fix 5 (unique
   application IDs) once consumers have signed off.
4. **Ongoing:** Fixes 7–9.

## Open questions

- Which namespace do PG Atlas and the SCF pages treat as canonical: `project:` or `application:`?
- For merged projects (Reclaim → zkFetch, Solidity → Solang Playground, Ionize → Transfuse), should
  the history be one project or two? This needs the maintainers' view.
- Does SDF create a new Airtable record when a project is renamed, or edit the existing one? The
  registry relies on record IDs surviving renames.
- Should OpenGrants ingest non-Build SCF awards (Liquidity, Activation, Community) so that projects
  like Blend keep their history?
