# OpenGrants SCF #42, #43, #44, #45 Intelligence Report

_Prepared by the OpenGrants team as a retrospective on SCF #42–#45 for delegates and the community.
Live analytics: [SCF profile](https://opengrants.daostar.org/system/scf)._

|  |  |
| --- | --- |
| **Rounds** | #42, #43, #44, #45 |
| **Data** | OpenGrants datalake (silver_scf_* tables, gold__scf_system_profile), as of 2026-10-09 |
| **Historical cohort** | Build awards, SCF #30–#41 (249 awards) |
| **Previous report** | [SCF #41 Intelligence Report](https://docs.google.com/document/d/12g5Sexty8JCJdkX1Nda0jnCs1bo4X8FhQbWWPZVX484) |

---

## Key takeaways

1. **Demand more than doubled, while funding per round grew more slowly.** Applications rose from
   82 (#42) to 218 (#45), and the award rate fell from 33% to 18%. Total awarded per round peaked at
   $4.6M in #44. (§I)
2. **Award sizes held steady, and max-ask awards became rare.** The average award ($100K) and median
   ($99K) are in line with history. Only 6 of 141 awards (4%) were at the $150K maximum, against 14%
   historically. The shift toward max-ask requests seen in #41 did not carry through to awards. (§I, §III)
3. **Funding concentrated in end-user applications and financial protocols.** Together they took 87%
   of the $14.15M awarded, up from 67% historically. Infrastructure & Services received no awards,
   and Developer Tooling's share slipped from 17% to 13%. (§IV)
4. **The delivery pattern from the #41 report still holds.** Developer Tooling remains the
   best-delivering category (78% fully complete) at the lowest average award ($84K). Financial
   Protocols remain the most expensive ($114K) with the lowest completion (59%). Awards of $100K+
   complete less often (60%) than smaller ones (74–80%). (§III, §IV)
5. **Returning projects are a small share (10%), but several are being re-funded quickly.** 14 of 141
   awards went to projects funded before, and every one of them had fully delivered its prior award
   except Rumble Fish (67%). Seven now have lifetime awards above $150K. (§II)

## I. Rounds at a glance

| Round | Quarter | Applied | Awarded | Award rate | Total awarded | Average | Median | At max ask ($150,000) |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCF #42 | Q1 '26 | 82 | 27 | 33% | $2,461,916 | $91,182 | $86,000 | 7% |
| SCF #43 | Q2 '26 | 84 | 28 | 33% | $3,049,069 | $108,895 | $100,000 | 7% |
| SCF #44 | Q2 '26 | 174 | 46 | 26% | $4,596,089 | $99,915 | $98,000 | 0% |
| SCF #45 | Q3 '26 | 218 | 40 | 18% | $4,043,616 | $101,090 | $100,000 | 5% |
| **#42–#45 combined** |  | **558** | **141** | **25%** | **$14,150,690** | **$100,360** | **$98,560** | **4%** |
| **History #30–#41** |  |  | 249 |  | $23,988,695 | $96,340 | $99,000 | 14% |

**Observations:**

- Applications grew 2.6× between #43 and #45 (84 → 218). Awards grew less (28 → 40), so
  competition for funding is the tightest it has been in the tranche era.
- #42–#45 awarded $14.15M in four rounds, 59% of everything awarded across the twelve rounds of
  #30–#41.
- Despite the #41 report noting a rising share of $150K requests, awards did not follow: the share at
  max ask dropped to 4%.

## II. Returning projects

| Project | Awarded in | Prior rounds | Prior awarded | Prior award completion (today) | New award | Lifetime |
| --- | --- | --- | --- | --- | --- | --- |
| **Bingtellar** | SCF #42 | #26 | $30,000 | n/a (pre-tranche) | $112,815 | $142,815 |
| **CodeLnPay** | SCF #42 | #25, #33 | $128,023 | 100% | $19,200 | $147,223 |
| **Rumble Fish Software Development - RFP** | SCF #42 | #41 | $131,200 | 100% | $55,000 | $186,200 |
| **JetPad** | SCF #43 | #34 | $75,500 | 100% | $74,500 | $150,000 |
| **Seasonal Workers Payroll** | SCF #43 | #37 | $75,000 | 100% | $100,000 | $175,000 |
| **Seevcash** | SCF #43 | #36 | $142,299 | 100% | $149,360 | $291,659 |
| **ChimpDAO** | SCF #44 | #38 | $105,000 | 100% | $110,000 | $215,000 |
| **Choppaddi** | SCF #44 | #38 | $70,000 | 100% | $80,000 | $150,000 |
| **ROZO - One Tap to Pay** | SCF #44 | #38 | $150,000 | 100% | $98,000 | $248,000 |
| **BIM Exchange** | SCF #45 | #42 | $107,700 | 100% | $39,600 | $147,300 |
| **Liqvid** | SCF #45 | #37 | $137,500 | 100% | $97,500 | $235,000 |
| **Rumble Fish Software Development - RFP** | SCF #45 | #41, #42 | $186,200 | 67% | $78,000 | $264,200 |
| **SwiftEx** | SCF #45 | #35 | $65,000 | 100% | $54,500 | $119,500 |
| **lend.xyz** | SCF #45 | #43 | $120,560 | 100% | $92,900 | $213,460 |

14 of 141 awards in these rounds went to projects funded before (13 distinct projects; Rumble Fish was
awarded twice).

_Completion is the prior award's tranche completion as of 2026-10-09, not at the time of the new
award. Projects are matched by DAOIP-5 `projectId`, which is derived from the Airtable name, so
renamed projects can be missed. Choppaddi, for example, is FastBuka renamed (see
`docs/data-quality/scf_canonical_id_data_loss_report_2026-10-09.md`)._

**Observations:**

- Every returning project except Rumble Fish has fully delivered its prior award. Rumble Fish received
  awards in three of five rounds (#41, #42, #45); its #45 award came while its #42 award stood at 67%.
- Re-funding is fast for some: BIM Exchange (#42 → #45) and lend.xyz (#43 → #45) returned within two
  or three rounds.
- Seven projects now have lifetime awards above $150K: Seevcash ($292K), Rumble Fish ($264K), ROZO
  ($248K), Liqvid ($235K), ChimpDAO ($215K), lend.xyz ($213K) and Seasonal Workers Payroll ($175K).

## III. Funding distribution

| Era | Awards | Average | Median |
| --- | --- | --- | --- |
| Pre-tranche (< #30, all award types) | 516 | $62,188 | $49,996 |
| Tranche era #30–#41 | 249 | $96,340 | $99,000 |
| SCF #42–#45 | 141 | $100,360 | $98,560 |

### Award size vs. delivery (SCF #30–#41)

| Award size | Awards | Fully complete (100%) | Average tranche completion |
| --- | --- | --- | --- |
| Under $50,000 | 34 | 74% | 83% |
| $50,000 – $99,999 | 94 | 80% | 86% |
| $100,000 and above | 121 | 60% | 77% |
| **All** | 249 | 69% | 82% |

**Observations:**

- Award size has been stable since the tranche structure began: average and median both sit around
  $96–100K.
- Larger awards still deliver less reliably. Awards of $100K and above are fully complete 60% of the
  time, against 80% for $50–99K. They are also the largest bracket, at 121 of 249 awards.

## IV. Category breakdown

> **Note on categories:** SCF's category list changed during the tranche era. "Applications" and
> "End-User Application" are the same category under its old and new names: #42–#45 use
> "End-User Application" almost exclusively. The combined row below is the meaningful comparison.

### History (SCF #30–#41)

| Category | Awards | Total awarded | Average | Fully complete | Average completion |
| --- | --- | --- | --- | --- | --- |
| Applications + End-User Application | 119 | $11,000,560 | $92,442 | 69% | 81% |
| _of which "Applications"_ | _82_ | _$7,299,047_ | _$89,013_ | _67%_ | _78%_ |
| _of which "End-User Application"_ | _37_ | _$3,701,513_ | _$100,041_ | _73%_ | _86%_ |
| Financial Protocols | 44 | $5,015,954 | $113,999 | 59% | 78% |
| Developer Tooling | 49 | $4,098,771 | $83,648 | 78% | 89% |
| Infrastructure & Services | 37 | $3,873,410 | $104,687 | 70% | 81% |

### SCF #42–#45 vs. history

| Category | Awards | Total awarded | Share of #42–#45 | Historical share |
| --- | --- | --- | --- | --- |
| Applications + End-User Application | 84 | $8,312,566 | 59% | 46% |
| Financial Protocols | 39 | $4,012,524 | 28% | 21% |
| Developer Tooling | 18 | $1,825,600 | 13% | 17% |
| Infrastructure & Services | 0 | $0 | 0% | 16% |

**Observations:**

- End-user applications and financial protocols took 87% of funding in #42–#45, up from 67%.
- Infrastructure & Services received no awards in four rounds, after 37 awards and 16% of funding in
  #30–#41. This may reflect a real change in what was funded, or projects being categorised
  differently under the new taxonomy; it should be confirmed with SCF before drawing conclusions.
- Developer Tooling remains the best-delivering category (78% fully complete) at the lowest average
  award, yet its share of funding fell from 17% to 13%. The #41 report's observation that tooling is
  underfunded relative to its delivery record still holds.
- Financial Protocols' share rose to 28% while remaining the category with the highest average award
  and lowest completion rate.

## V. Tranche completion by round

_Recent rounds are still mid-delivery, so lower completion there is expected._

| Round | Awards | Fully complete | Average completion | No tranche paid yet |
| --- | --- | --- | --- | --- |
| SCF #30 | 22 | 91% | 94% | 5% |
| SCF #31 | 22 | 73% | 82% | 5% |
| SCF #32 | 17 | 88% | 94% | 0% |
| SCF #33 | 14 | 71% | 83% | 7% |
| SCF #34 | 17 | 82% | 90% | 0% |
| SCF #35 | 21 | 71% | 76% | 19% |
| SCF #36 | 23 | 57% | 75% | 4% |
| SCF #37 | 19 | 74% | 82% | 5% |
| SCF #38 | 24 | 83% | 90% | 0% |
| SCF #39 | 12 | 67% | 78% | 8% |
| SCF #40 | 24 | 54% | 72% | 8% |
| SCF #41 | 34 | 41% | 72% | 6% |
| SCF #42 | 27 | 48% | 78% | 4% |
| SCF #43 | 28 | 32% | 70% | 0% |
| SCF #44 | 46 | 11% | 46% | 15% |
| SCF #45 | 40 | 0% | 4% | 90% |

**Observations:**

- Mature rounds (#30–#39) mostly reach 70–90% full completion. #36 (57%) is the weakest of them.
- #35 stands out: 4 of its 21 awards (19%) have still received no tranche payment, over a year after
  the round.
- #42 and #43 are progressing in line with earlier rounds at the same age. #44 and #45 are too recent
  to assess.

## VI. Since the SCF #41 report

- **The completion headline has changed, and the method has too.** The #41 report gave 37% of
  projects as fully complete. On today's data the tranche-era figure is **69%** of 249 awards.
  Two things explain the gap: projects have completed tranches since February, and the #41 report
  mixed different project counts across its tables (255, 211, 214 and 248). This report uses one cohort
  throughout; the methodology below defines it.
- **Developer Tooling's delivery advantage persists** (fully complete 45% → 78%; average completion
  68% → 89%), as does its lower share of funding.
- **Larger awards still deliver less reliably**, consistent with the #41 finding.
- **Max-ask pressure eased**: the #41 report flagged a growing share of $150K requests (median request
  near $130K). Awarded amounts in #42–#45 settled back to a $99K median.
- **Returning applicants flagged in #41** (Wirex, Trustless Work, Tansu): not tracked in this report.
  They can be added to the next one.

## Data quality and caveats

- Data as of 2026-10-09. #44 and #45 are still paying out, and completion figures for them are partial.
- **7 awards in these rounds ($742,000, 5% of the total) have a `projectId` with no row in
  `silver_scf_projects`.** They count in round and category totals, but are missing from project
  history, so returning-project matches may be undercounted.
- Gold reconciliation (`public.gold__scf_system_profile`): gold reports 933 applications /
  $70,228,329, and silver reports the same — ✅ match.
- Tables count Build awards only. Earlier award types (Activation, Community, Legacy) count as prior
  funding history in section II and in the pre-tranche row of section III.
- Categories follow SDF Airtable at the snapshot date, including the taxonomy change noted in
  section IV.
- Project identity follows Airtable names, which change; see the ID stability report.

## Methodology

- **Cohort:** Build awards with awarded amount > 0. History = SCF #30 (tranche structure introduced)
  to #41.
- **Fully complete:** tranche completion = 100%. **Average completion:** mean tranche completion %.
- **Max ask:** award ≥ $150,000.
- **Source tables:** `silver_scf_grant_applications` (awards), `silver_scf_grant_pools` (rounds,
  applied counts), `silver_scf_projects` (project IDs), `gold__scf_system_profile` (totals check).
- **Reproduce:** `DATABASE_URL=... python3 scripts/scf_intelligence_report.py --rounds 42 43 44 45
  --prev-report 41`. Category merging and narrative were added by hand.
