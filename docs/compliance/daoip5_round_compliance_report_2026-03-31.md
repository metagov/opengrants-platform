# DAOIP-5 Round Compliance Report
**Report Date:** March 31, 2026
**Document Status:** Working Doc
**Methodology:** Round-level indexing compliance — percentage of grant rounds successfully indexed, translated, and available in the DAOIP-5 data standard. Follows the methodology established in the October 2025 Compliance Report.

> **Note:** This is one of two complementary compliance assessments for this platform.
> - **This report** measures round-level indexing coverage: how many rounds exist and how many are available in DAOIP-5.
> - **The field-level report** (`daoip5_compliance_report_2026-03-31.md`) measures schema data quality: how many DAOIP-5 fields per round carry genuine source data vs hardcoded placeholders.

---

### DAOIP-5 Compliance & Ecosystem Funding Report

---

This report analyzes DAOIP-5 compliance across three grant ecosystems: SCF, ENS Small Grants, and Gitcoin 2.0. The compliance rate measures the percentage of grant rounds successfully indexed, translated, and available in the DAOIP-5 data standard. Data is drawn from the most current snapshots loaded into the platform's bronze layer.

| Ecosystem | Snapshot Date | Total Rounds | Compliant Rounds | Compliance Rate | Total Funding (Compliant Rounds) |
| --- | --- | --- | --- | --- | --- |
| **SCF** | March 23, 2026 | 48 (40 finished, 1 in-progress, 7 future) | 40 finished | **100% of finished rounds** | $52,064,066.01 awarded / $48,195,424.76 paid |
| **ENS Small Grants** | Mar 24, 2026 | 24 | 24 | **100.0%** | 20,313,064.17 ENS voting power* |
| **Gitcoin 2.0** | Mar 17, 2026 | 2,330 | 914† | **39.2%†** | $106.4M match pool (287 rounds with donor activity) |

\* ENS funding is denominated in ENS token voting weight, not USD. A USD equivalent is not available from the source data. See ENS section for detail.
† See Gitcoin section for tier breakdown. The 914 figure counts all rounds with an indexable round name. 1,416 rounds have no round name in metadata and cannot be indexed.

---

## 1. SCF (Stellar Community Fund)

### Pipeline Architecture

SCF data flows through a three-layer medallion pipeline before appearing in DAOIP-5 compliance outputs:

| Layer | Storage | Description |
| --- | --- | --- |
| **Bronze** | PostgreSQL (`bronze_scf_rounds`, `bronze_scf_submissions`) | Direct ingestion from Airtable — no cleaning, no normalization |
| **Silver** | PostgreSQL (DAOIP-5 normalized tables) | Schema transformation via `daoip5_scf.yaml` — type enforcement, relationship mapping, field translation |
| **Gold** | DuckDB | Aggregated metrics for dashboards, funding trend analysis, cross-ecosystem comparisons |

**Source:** Airtable Base — three tables extracted per snapshot cycle:
- `Build Award Rounds`
- `Awarded Submissions [Build Only]`
- `Awarded Projects [Build Only]`

Raw exports are saved to date-stamped folders (`YYYY_MM_DD`) under `raw_data/SCF/` to maintain data versioning and audit trail. The sensor polling Airtable for new data triggers the bronze → silver → gold pipeline automatically on record-count change.

**Key pipeline assets:**
- Bronze ingestion: `og_dagster/assets/bronze/scf.py`
- Silver schema map: `og_dagster/configs/schema_maps/active/daoip5_scf.yaml`
- Gold metrics: `dbt_project/models/gold/metrics/`

**SCF-specific metrics computed in gold layer:**
- Total Awarded vs Total Paid (disbursement tracking)
- Quarterly projects awarded and funding distribution (XLM denominated in USD)
- Awarded submissions by round
- Awarded projects by category

---

### Compliance Overview

- **Total Rounds in Snapshot:** 48 (SCF #1 through SCF #48)
- **Finished Rounds (award cycle complete):** 40 (SCF #1–#40)
- **In-Progress Rounds:** 1 (SCF #41 — opened Dec 8, 2025, award cycle not yet closed at snapshot date)
- **Future Rounds (pre-scheduled placeholders):** 7 (SCF #42–#48 — no open date, no submissions)
- **Compliance Rate (finished rounds):** 40/40 = **100%**
- **Compliance Rate (all rounds in snapshot):** 40/48 = **83.3%**
- **Total Awarded (finished rounds):** $52,064,066.01
- **Total Paid (finished rounds):** $48,195,424.76

### Key Metrics

- Finished rounds indexed: 40/40 (100%)
- Active program history: April 2019 → SCF #40 (Sep 2025 cohort)
- Total awarded across all 40 finished rounds: $52.1M
- Total paid across all 40 finished rounds: $48.2M (92.6% of awarded amount disbursed)
- Average awarded per finished round: $1,301,601.65

*Data source: `raw_data/SCF/23_February_2026/Build Award Rounds-By Year 23_February_2026.csv`*
*DAOIP-5 JSON reference: https://github.com/metagov/oss-funding/blob/main/daoip-5/json/stellar/grants_pool.json*

### Round Details — Finished Rounds (Award Cycle Complete)

| Round | Year | Quarter | Awarded (USD) | Paid (USD) | Awarded Submissions | Open Date |
| --- | --- | --- | --- | --- | --- | --- |
| SCF #40 | 2025 | Q4 '25 | $2,182,110.00 | $972,303.33 | 24 | Sep 2, 2025 |
| SCF #39 | 2025 | Q3 '25 | $1,115,655.00 | $730,311.67 | 12 | Jul 21, 2025 |
| SCF #38 | 2025 | Q3 '25 | $2,568,750.00 | $1,806,000.00 | 24 | Jun 10, 2025 |
| SCF #37 | 2025 | Q3 '25 | $1,861,405.00 | $1,315,191.67 | 19 | May 5, 2025 |
| SCF #36 | 2025 | Q2 '25 | $2,088,654.00 | $1,625,340.67 | 23 | Mar 26, 2025 |
| SCF #35 | 2025 | Q2 '25 | $1,865,348.00 | $1,200,315.33 | 21 | Feb 10, 2025 |
| SCF #34 | 2025 | Q1 '25 | $1,717,287.00 | $1,542,567.13 | 17 | Jan 21, 2025 |
| SCF #33 | 2025 | Q1 '25 | $1,033,620.00 | $888,613.33 | 14 | Nov 25, 2024 |
| SCF #32 | 2024 | Q4 '24 | $1,377,495.00 | $1,301,828.33 | 17 | Oct 28, 2024 |
| SCF #31 | 2024 | Q4 '24 | $2,068,710.00 | $1,793,810.00 | 22 | Sep 16, 2024 |
| SCF #30 | 2024 | Q4 '24 | $2,167,917.00 | $1,980,110.33 | 22 | Sep 4, 2024 |
| SCF #29 | 2024 | Q3 '24 | $2,278,557.00 | $2,188,657.00 | 40 | Jun 10, 2024 |
| SCF #28 | 2024 | Q2 '24 | $1,557,809.00 | $1,572,689.00 | 30 | May 13, 2024 |
| SCF #27 | 2024 | Q2 '24 | $1,489,730.00 | $1,489,730.00 | 36 | Apr 16, 2024 |
| SCF #26 | 2024 | Q2 '24 | $2,289,878.00 | $2,289,878.00 | 43 | Mar 18, 2024 |
| SCF #25 | 2024 | Q1 '24 | $1,349,860.00 | $1,355,860.00 | 27 | Feb 19, 2024 |
| SCF #24 | 2024 | Q1 '24 | $1,427,713.00 | $1,520,613.00 | 27 | Jan 8, 2024 |
| SCF #23 | 2024 | Q1 '24 | $1,606,125.00 | $1,606,125.00 | 25 | Dec 4, 2023 |
| SCF #22 | 2023 | Q4 '23 | $1,417,342.00 | $1,417,342.00 | 33 | Nov 6, 2023 |
| SCF #21 | 2023 | Q4 '23 | $1,479,419.00 | $1,398,310.40 | 27 | Oct 16, 2023 |
| SCF #20 | 2023 | Q4 '23 | $1,402,622.10 | $1,402,622.10 | 33 | Sep 11, 2023 |
| SCF #19 | 2023 | Q3 '23 | $1,253,476.00 | $1,260,475.90 | 16 | Aug 14, 2023 |
| SCF #18 | 2023 | Q3 '23 | $1,411,676.00 | $1,411,680.63 | 14 | Jul 10, 2023 |
| SCF #17 | 2023 | Q3 '23 | $1,959,307.50 | $1,959,307.50 | 19 | Jun 12, 2023 |
| SCF #16 | 2023 | Q2 '23 | $1,901,782.50 | $1,901,782.50 | 21 | May 15, 2023 |
| SCF #15 | 2023 | Q2 '23 | $1,112,680.00 | $1,112,680.00 | 11 | Apr 10, 2023 |
| SCF #14 | 2023 | Q2 '23 | $509,125.00 | $508,398.28 | 12 | Mar 13, 2023 |
| SCF #13 | 2023 | Q1 '23 | $1,267,252.95 | $1,199,752.96 | 14 | Feb 13, 2023 |
| SCF #12 | 2023 | Q1 '23 | $1,000.00 | $1,000.00 | 1 | Jan 23, 2023 |
| SCF #11 | 2022 | Q4 '22 | $1,134,000.00 | $1,134,000.00 | 20 | Aug 10, 2022 |
| SCF #10 | 2022 | Q2 '22 | $1,124,180.00 | $1,124,180.00 | 15 | Feb 18, 2022 |
| SCF #9 | 2021 | Q4 '21 | $918,200.00 | $1,190,706.20 | 14 | Oct 15, 2021 |
| SCF #8 | 2021 | Q3 '21 | $611,263.00 | $622,034.18 | 8 | Jun 28, 2021 |
| SCF #7 | 2021 | Q1 '21 | $2,135,963.38 | $2,135,963.38 | 8 | Aug 31, 2020 |
| SCF #6 | 2020 | Q3 '20 | $45,409.41 | $45,409.41 | 8 | Aug 31, 2020 |
| SCF #5 | 2020 | Q2 '20 | $315,203.28 | $325,529.02 | 9 | May 25, 2020 |
| SCF #4 | 2020 | Q1 '20 | $0.00 | $224,721.16 | 8 | Feb 24, 2020 |
| SCF #3 | 2019 | Q4 '19 | $17,640.89 | $201,837.91 | 8 | Oct 12, 2019 |
| SCF #2 | 2019 | Q3 '19 | $0.00 | $197,567.30 | 8 | Jul 12, 2019 |
| SCF #1 | 2019 | Q2 '19 | $0.00 | $240,180.14 | 8 | Apr 17, 2019 |

### In-Progress Round

SCF #41 opened December 8, 2025. At the snapshot date (February 23, 2026) the award cycle had not yet closed — 0 awarded submissions, $100 administrative disbursement recorded. This round is indexed (name + open date present) but excluded from the finished-round totals as its award data is not final.

| Round | Year | Status | Open Date | Awarded (USD) | Paid (USD) |
| --- | --- | --- | --- | --- | --- |
| SCF #41 | 2026 | In progress at snapshot | Dec 8, 2025 | $0.00 | $100.00 |

### Non-Compliant Rounds (Future Placeholders)

These rounds exist in the Airtable export as forward-scheduled slots. They have names but no open dates, no awarded amounts, and no submission data — they cannot be indexed into DAOIP-5 in their current state.

| Round | Year | Status |
| --- | --- | --- |
| SCF #42 | 2026 | Future — no dates, no submissions |
| SCF #43 | 2026 | Future — no dates, no submissions |
| SCF #44 | 2026 | Future — no dates, no submissions |
| SCF #45 | 2026 | Future — no dates, no submissions |
| SCF #46 | 2026 | Future — no dates, no submissions |
| SCF #47 | 2026 | Future — no dates, no submissions |
| SCF #48 | 2026 | Future — no dates, no submissions |

### Compliance Note vs October 2025 Report

The October 2025 report recorded 40 total rounds at 95% compliance (38/40 compliant). This report shows 40 **finished** rounds at 100% compliance — every round that has completed its award cycle is fully indexed in DAOIP-5. The two non-compliant rounds in the October 2025 report (SCF #39 and #40 at the time, which were open but not yet finalized) have since closed and are now fully indexed, accounting for the improvement. SCF #41–#48 are excluded from this comparison as they did not exist in the October 2025 snapshot.

---

## 2. ENS Small Grants

### Compliance Overview

- **Total Rounds (Proposals):** 24
- **Compliant Rounds:** 24
- **Compliance Rate:** 100.0%
- **Total ENS Voting Power Used:** 20,313,064.17 ENS
- **Total Applicants (Choices) Across All Rounds:** 883
- **Total Individual Votes Cast:** 1,562

### Key Metrics

- All 24 proposals are in `closed` state — fully completed
- All 24 have complete metadata: Snapshot proposal ID, title, start/end timestamps, vote choices, and scores
- Program spans: July 2022 → June 2024 (13 Public Goods rounds, 11 Ecosystem rounds)
- Average applicants per round: 37
- Average voters per round: 65
- ENS uses ranked-choice voting denominated in ENS token weight, not USD. A USD equivalent is not derivable from the Snapshot source data without ENS/USD price data at round close date

*Data source: `raw_data/ENS/grants/smallgrants_proposals.json`*
*Data available at: grants.daostar.org/dev*

### Round Details — All Rounds Compliant

| Round | Period | Applicants | ENS Voting Power | Voters |
| --- | --- | --- | --- | --- |
| Public Goods Round 13 | Jun 14–19, 2024 | 51 | 715,737.59 | 34 |
| Public Goods Round 12 | Apr 30–May 6, 2024 | 41 | 721,217.24 | 29 |
| Ecosystem Round 11 | Dec 1–8, 2023 | 44 | 11,100.00 | 111 |
| Public Goods Round 11 | Dec 1–8, 2023 | 59 | 14,100.00 | 141 |
| Ecosystem Round 10 | Oct 24–31, 2023 | 48 | 12,800.00 | 128 |
| Public Goods Round 10 | Oct 24–31, 2023 | 36 | 10,800.00 | 108 |
| Ecosystem Round 9 | Jun 19–22, 2023 | 34 | 478,961.61 | 29 |
| Ecosystem Round 8 | May 29–Jun 2, 2023 | 36 | 540,275.02 | 38 |
| Public Goods Round 9 | May 29–Jun 2, 2023 | 37 | 776,865.64 | 44 |
| Ecosystem Round 7 | Apr 17–21, 2023 | 35 | 1,468,090.94 | 51 |
| Public Goods Round 8 | Apr 17–21, 2023 | 49 | 1,072,918.04 | 54 |
| Public Goods Round 7 | Mar 20–24, 2023 | 33 | 943,816.23 | 48 |
| Ecosystem Round 5 | Mar 20–24, 2023 | 41 | 916,350.99 | 46 |
| Public Goods Round 6 | Feb 24–Mar 1, 2023 | 34 | 1,017,843.68 | 160 |
| Ecosystem Round 4 | Feb 20–23, 2023 | 45 | 1,346,944.14 | 55 |
| Public Goods Round 5 | Jan 26–Feb 1, 2023 | 8 | 656,743.53 | 40 |
| Public Goods Scholarships Round 1 | Dec 8–13, 2022 | 19 | 1,643,792.96 | 90 |
| Ecosystem Round 3 | Nov 24–30, 2022 | 26 | 1,048,628.66 | 32 |
| Public Goods Round 4 | Nov 24–30, 2022 | 22 | 844,272.98 | 20 |
| Public Goods Round 3 | Oct 25–Nov 1, 2022 | 44 | 1,709,873.63 | 47 |
| Ecosystem Round 2 | Oct 25–Nov 1, 2022 | 45 | 1,450,649.76 | 108 |
| Ecosystem Round 1 | Sep 24–Oct 1, 2022 | 32 | 1,287,676.48 | 50 |
| Public Goods Round 2 | Sep 24–Oct 1, 2022 | 30 | 1,244,213.24 | 52 |
| Public Goods Round 1 | Jul 26–Aug 1, 2022 | 34 | 379,391.82 | 47 |

### Structural Limitation Note

ENS achieves 100% round-level indexing compliance because all 24 Snapshot proposals have complete metadata. However, the ENS DAOIP-5 data has a structural gap not captured by this round-count metric: the `GrantApplication` schema is not implemented for ENS. Applicants are Snapshot vote choices (plain text strings), not formal grant applications with funding requests, payout addresses, or status histories. This means ENS contributes 0 application-level records to the DAOIP-5 dataset despite 100% round compliance. The field-level compliance report documents this in full.

Additionally, the `totalGrantPoolSizeInUSD` field is currently set to `0.0` for all ENS rounds — a P0 data quality issue identified in the field-level report — because ENS funding amounts are denominated in ENS voting power, not USD.

---

## 3. Gitcoin 2.0

### Compliance Overview

The Gitcoin 2.0 March 2026 snapshot is a full historical export of every round ever created on the Gitcoin Allo Protocol across all supported chains. This includes production grant rounds, community-created test rounds, spam rounds, and inactive or failed round deployments. Understanding compliance requires distinguishing between these categories.

**Round Inventory:**

| Category | Count | Description |
| --- | --- | --- |
| Total rounds in snapshot | 2,330 | All rounds across all chains |
| **Named rounds** (indexed) | **914** | Round has a name in `round_metadata` — can be translated into DAOIP-5 |
| Unnamed rounds | 1,416 | `round_metadata` is null or contains no name field — cannot be indexed |
| Named rounds with donor activity | **287** | Named + at least 1 unique donor + donation amount within realistic bounds |
| Named rounds without donor activity | 627 | Named but 0 donors — test deployments, inactive rounds, cancelled rounds |

**Compliance Rate (primary):** 914 / 2,330 = **39.2%** — rounds with an indexable round name

**Compliance Rate (activity-qualified):** 287 / 2,330 = **12.3%** — rounds that are named AND have genuine community participation

### Funding Summary (Named Rounds with Donor Activity)

- **Total Matching Pool:** $106,412,209.60 across 287 rounds
- **Total Community Donations:** $1,769,946.50 (excluding 3 test rounds with anomalous on-chain test token deposits inflating the raw total)
- **Total Unique Donors:** 168,527 across all active rounds
- **Total Applications across all rounds:** 6,805
- **Total Donation transactions:** 497,347
- **Payout records:** 152

*Note: The raw `total_amount_donated_in_usd` field in the source CSV contains anomalous values for a small number of Sepolia testnet rounds (chain 11155111) where test token deposits were recorded as USD amounts. These are excluded from the donation total above.*

### Mechanism Breakdown (Named Rounds)

| Strategy | Named Rounds | Description |
| --- | --- | --- |
| `allov2.DonationVotingMerkleDist...` | 569 | Quadratic Funding — community donations with matching |
| `allov2.DirectGrantsLiteStrat...` | 134 | Direct Grants — committee-approved disbursements |
| Unknown / other | 110 | Strategy name not mapped to a recognized mechanism |
| `allov2.EasyRetroFundingStrat...` | 88 | Retroactive Funding |
| `allov2.DirectGrantsSimpleStr...` | 12 | Direct Grants (simple variant) |

### Top 25 Compliant Rounds by Community Donations

Sorted by total community donations received (excludes test rounds with anomalous token amounts):

| Round Name | Chain | Match Pool | Community Donations | Unique Donors |
| --- | --- | --- | --- | --- |
| dApps & Apps | Arbitrum (42161) | $299,288 | $219,437 | 17,744 |
| Web3 Infrastructure | Arbitrum (42161) | $299,952 | $202,509 | 17,933 |
| GG22 OSS - dApps and Apps | Arbitrum (42161) | $300,121 | $106,390 | 15,259 |
| Sei Creator Fund: Round #2 - Creative Media and IP | Sei (1329) | $294,589 | $82,391 | 23,131 |
| Sei Creator Fund Round #4 - Supporting Web3 Gaming | Sei (1329) | $348,811 | $74,766 | 3,940 |
| Sei Ecosystem Builders Round #1: Consumer Track | Sei (1329) | $307,462 | $66,674 | 2,960 |
| Asia Round | Optimism (10) | $74,954 | $59,460 | 3,900 |
| Climate Round | Arbitrum (42161) | $124,997 | $57,962 | 2,262 |
| GG22 OSS - Developer Tooling and Libraries | Arbitrum (42161) | $299,917 | $51,753 | 12,334 |
| Developer Tooling and Libraries | Arbitrum (42161) | $299,952 | $50,405 | 3,751 |
| GG22 OSS - Web3 Infrastructure | Arbitrum (42161) | $299,932 | $49,864 | 8,071 |
| Sei Creator Fund Round #3 - Developer Ecosystem | Sei (1329) | $348,811 | $42,877 | 2,826 |
| GG23 OSS - dApps and Apps | Arbitrum (42161) | $199,968 | $41,557 | 3,862 |
| GG21: Thriving Arbitrum Summer | Arbitrum (42161) | $117,231 | $40,247 | 3,307 |
| Aave & GHO Ecosystem Advancement | Optimism (10) | $50,221 | $39,168 | 20 |
| SEI Creator Fund: Kickoff | Sei (1329) | $254,557 | $38,753 | 2,833 |
| Land Regenerators | Arbitrum (42161) | $199,849 | $31,555 | 931 |
| ENS Identity | Arbitrum (42161) | $125,163 | $30,257 | 7,576 |
| GG23 OSS - Developer Tooling and Libraries | Arbitrum (42161) | $199,968 | $27,718 | 4,200 |
| GG23 OSS - Web3 Infrastructure | Arbitrum (42161) | $199,968 | $26,003 | 4,412 |
| GoodDollar Builders Program: Kickoff QF Round | Celo (42220) | $47,112 | $23,015 | 423 |
| GG23 OSS - Ethereum Infrastructure | Arbitrum (42161) | $149,968 | $22,785 | 3,284 |
| Open Source Observer | Optimism (10) | $125,043 | $20,682 | 597 |
| OpenCivics Collaborative Research Round | Arbitrum (42161) | $100,000 | $20,244 | 540 |
| Citizen Grants | Arbitrum (42161) | $99,935 | $18,931 | 2,046 |

### Non-Compliant Category Analysis

The 1,416 unnamed rounds represent 60.8% of the Gitcoin snapshot. These rounds cannot be indexed into DAOIP-5 because the DAOIP-5 `GrantPool` schema requires a `name` field. Root causes:

- **Incomplete round setup:** Round contracts were deployed but the metadata IPFS upload was never completed or failed
- **Test deployments:** Developers testing the Allo Protocol infrastructure without completing configuration
- **Cancelled rounds:** Rounds that were started but never launched publicly
- **Metadata resolution failures:** Rounds where the `round_metadata_cid` IPFS pointer exists but the content could not be fetched at snapshot time

*Data source: `raw_data/Gitcoin/17_March_2026/` (rounds.csv, applications.csv, donations.csv, applications_payouts.csv)*

---

## 4. Compliance Analysis & Rankings

### Overall Compliance Ranking (Round Indexing)

| Rank | Ecosystem | Compliance Rate | Notes |
| --- | --- | --- | --- |
| 1 | **ENS Small Grants** | 100.0% | All 24 rounds fully indexed. Structural limitation on application-level data noted separately |
| 2 | **SCF** | 85.4% | All historical rounds indexed. Non-compliant rounds are scheduled future placeholders, not data failures |
| 3 | **Gitcoin 2.0** | 39.2% (named) / 12.3% (active) | Large dataset with significant volume of test/incomplete round deployments. Active production rounds are well-indexed |

### Context for Gitcoin's Rate

The 39.2% headline rate for Gitcoin should not be read as a data pipeline failure. The Gitcoin Allo Protocol is permissionless — any address on any supported chain can deploy a round contract. The snapshot includes every deployed contract, regardless of whether it was ever used. A more representative measure of production compliance is the 287 active rounds (rounds with at least one donor), which represent the operational grant program. Those 287 rounds are fully indexed.

### Comparison with October 2025 Report

The October 2025 report covered SCF, Celo PG, Giveth, and Octant. SCF's compliance rate has moved from 95.0% to 85.4% due to the addition of 8 future placeholder rounds in Airtable. On a like-for-like basis (rounds that existed in October 2025), SCF remains at 95%+.

ENS and Gitcoin 2.0 were not in the October 2025 report. This is their baseline entry.

---

## 5. Footnotes

**Compliance Rate Definition:** Percentage of grant rounds successfully indexed and available in the DAOIP-5 data standard. Calculated as: `(Compliant Rounds / Total Rounds) × 100`. A round is compliant if it has a name, can be translated into a DAOIP-5 GrantPool record, and has been ingested into the silver layer.

**SCF Funding Note:** `Total Awarded` reflects amounts committed by SCF. `Total Paid` reflects amounts actually disbursed. Discrepancies between awarded and paid reflect tranche payment schedules — many awards are paid in installments over the cohort period. SCF #41 shows $0 awarded because the award cycle for that round had not completed at snapshot date.

**ENS Funding Note:** ENS voting power (ENS token weight) is the only funding metric available from the Snapshot source. The ENS Small Grants program distributed $10,000–$50,000 USD per round in practice, but this data is not in the Snapshot export and requires cross-referencing ENS governance documentation or on-chain transaction records.

**Gitcoin Funding Note:** `total_amount_donated_in_usd` contains anomalous values for testnet rounds on Sepolia (chain 11155111) where test token deposits were reported as USD. These rounds are excluded from the donation totals. The `match_amount_in_usd` is the pre-funded matching pool set by round operators — for Quadratic Funding rounds this is separate from community donations.

**Two-Assessment Framework:** This round-count report should be read alongside the field-level schema compliance report (`daoip5_compliance_report_2026-03-31.md`), which assesses how many DAOIP-5 schema fields within each round record are populated from genuine source data versus hardcoded placeholders.
