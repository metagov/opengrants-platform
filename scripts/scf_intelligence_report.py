"""Generate an OpenGrants SCF Intelligence Report from the OpenGrants datalake.

Usage (silver + gold tables written by the Dagster pipeline):
    DATABASE_URL=postgresql://... python3 scripts/scf_intelligence_report.py \
        --rounds 42 43 44 45 --prev-report 41 > report.md

Reads:
    public.silver_scf_grant_applications   one row per award (DAOIP-5 grantApplication)
    public.silver_scf_grant_pools          one row per round (DAOIP-5 grantPool)
    public.silver_scf_projects             one row per project (DAOIP-5 project)
    gold.gold__scf_system_profile          totals, used to reconcile the report against gold

Offline / tests: pass a raw_data/SCF/<date>/ CSV snapshot folder instead of a database:
    python3 scripts/scf_intelligence_report.py --snapshot raw_data/SCF/23_February_2026 --rounds 37 38 39 40

Figures cover Build awards with a non-zero awarded amount. The historical cohort is
every tranche-era round (SCF #30 onwards) before the first reported round, so all
historical tables share one denominator. Narrative takeaways are left as TODO
placeholders for the analyst; every number is computed here.
"""
import argparse
import csv
import datetime as dt
import os
import re
import statistics as st
from collections import defaultdict
from pathlib import Path

csv.field_size_limit(10**9)
TRANCHE_ERA_START = 30
MAX_ASK = 150_000
EXT = "org.stellar.communityfund."
GOLD_SCHEMAS = ("gold", "public_gold", "public")


def money(v):
    if isinstance(v, (int, float)):
        return float(v)
    v = re.sub(r"[^0-9.]", "", v or "")
    try:
        return float(v) if v else 0.0
    except ValueError:
        return 0.0


def pct(v):
    if v is None or isinstance(v, (int, float)):
        return None if v is None else float(v)
    v = re.sub(r"[^0-9.]", "", v)
    return float(v) if v else None


def rnum(name):
    m = re.search(r"#\s*(\d+)", name or "")
    return int(m.group(1)) if m else None


def usd(x):
    return f"${x:,.0f}"


def share(n, d):
    return f"{n / d:.0%}" if d else "—"


def scf_project_id(name):
    # Same transform as og_dagster/configs/schema_maps/active/daoip5_scf.yaml (projectId)
    name = (name or "").strip().strip('"')
    return f"daoip-5:scf:project:{name.lower().replace(' ', '_')}" if name else None


def award(round_name, project_id, project, category, awarded, paid, completion, award_type):
    return {
        "round": rnum(round_name),
        "project_id": project_id,
        "project": (project or "").strip().strip('"'),
        "category": (category or "").strip() or "Uncategorised",
        "awarded": money(awarded),
        "paid": money(paid),
        "completion": pct(completion),
        "build": (award_type or "").strip() == "Build",
    }


def load_datalake(url):
    """Silver tables for detail, gold profile for reconciliation."""
    from sqlalchemy import create_engine, text

    if url.startswith("postgresql+psycopg2://"):
        url = "postgresql://" + url[len("postgresql+psycopg2://"):]
    engine = create_engine(url)
    with engine.connect() as c:
        apps = c.execute(text(f'''
            SELECT "grantPoolName", "projectId", "{EXT}project" AS project, "{EXT}category" AS category,
                   "{EXT}totalAwardedUSD" AS awarded, "{EXT}totalPaidUSD" AS paid,
                   "{EXT}trancheCompletionPercent" AS completion, "{EXT}awardType" AS award_type
            FROM silver_scf_grant_applications''')).all()
        pools = c.execute(text(f'''
            SELECT name, "{EXT}quarterYear" AS quarter, "{EXT}appliedSubmissions" AS applied
            FROM silver_scf_grant_pools''')).all()
        project_ids = {r[0] for r in c.execute(text("SELECT id FROM silver_scf_projects"))}
        gold = None
        for schema in GOLD_SCHEMAS:
            try:
                gold = c.execute(text(
                    f'SELECT total_applications, total_funding_distributed_usd FROM "{schema}".gold__scf_system_profile'
                )).first()
                gold = {"schema": schema, "applications": gold[0], "funding": float(gold[1] or 0)}
                break
            except Exception:
                c.rollback()
    return {
        "awards": [award(*r) for r in apps],
        "pools": {rnum(r[0]): {"quarter": r[1] or "", "applied": r[2]} for r in pools if rnum(r[0])},
        "project_ids": project_ids,
        "gold": gold,
        "silver_totals": {"applications": len(apps),
                          "funding": sum(money(r[4]) for r in apps)},
    }


def load_snapshot(d):
    def rd(prefix):
        (f,) = [p for p in Path(d).iterdir() if p.name.startswith(prefix) and p.suffix == ".csv"]
        return list(csv.DictReader(open(f, encoding="utf-8-sig")))

    projects, subs, rounds = rd("Awarded Projects"), rd("Awarded Submissions"), rd("Build Award Rounds")
    return {
        "awards": [award(s["Round"], scf_project_id(s.get("Project")), s.get("Project"),
                         s.get("Category (from Project)"), s.get("Total Awarded (USD)"),
                         s.get("Total Paid (USD)"), s.get("Tranche Completion %"), s.get("Award Type"))
                   for s in subs],
        "pools": {rnum(r["Name"]): {"quarter": r.get("Quarter, Year", ""), "applied": r.get("Applied Submissions")}
                  for r in rounds if rnum(r["Name"])},
        "project_ids": {scf_project_id(p.get("Title")) for p in projects},
        "gold": None,
        "silver_totals": None,
    }


def table(headers, rows):
    out = ["| " + " | ".join(headers) + " |", "| " + " | ".join("---" for _ in headers) + " |"]
    out += ["| " + " | ".join(str(c) for c in r) + " |" for r in rows]
    return "\n".join(out)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--snapshot", help="CSV snapshot folder instead of $DATABASE_URL (offline/tests)")
    ap.add_argument("--rounds", nargs="+", type=int, required=True)
    ap.add_argument("--prev-report", type=int)
    ap.add_argument("--snapshot-date", default=None)
    a = ap.parse_args()

    if a.snapshot:
        data = load_snapshot(a.snapshot)
        source = f"CSV snapshot {Path(a.snapshot).name}"
        snap_date = a.snapshot_date or Path(a.snapshot).name
    else:
        url = os.environ.get("DATABASE_URL")
        if not url:
            ap.error("set DATABASE_URL to the OpenGrants datalake, or pass --snapshot")
        data = load_datalake(url)
        source = "OpenGrants datalake (silver_scf_* tables, gold__scf_system_profile)"
        snap_date = a.snapshot_date or dt.date.today().isoformat()
    targets = sorted(a.rounds)
    first = targets[0]

    all_awards = [x for x in data["awards"] if x["round"] is not None and x["awarded"] > 0]
    # Build awards drive every table; any award type counts as funding history.
    awards = [x for x in all_awards if x["build"]]
    tgt = [x for x in awards if x["round"] in targets]
    base = [x for x in awards if TRANCHE_ERA_START <= x["round"] < first]
    pre = [x for x in all_awards if x["round"] < TRANCHE_ERA_START]
    rmeta = data["pools"]

    title_rounds = ", ".join(f"#{r}" for r in targets)
    L = []
    L.append(f"# OpenGrants SCF {title_rounds} Intelligence Report\n")
    L.append(
        "_Prepared by the OpenGrants team as a retrospective on SCF "
        f"{title_rounds} for delegates and the community. Live analytics: "
        "[SCF profile](https://opengrants.daostar.org/system/scf)._\n"
    )
    L.append(table(["", ""], [
        ["**Rounds**", title_rounds],
        ["**Data**", f"{source}, as of {snap_date}"],
        ["**Historical cohort**", f"Build awards, SCF #{TRANCHE_ERA_START}–#{first - 1} ({len(base)} awards)"],
        ["**Previous report**", f"SCF #{a.prev_report} Intelligence Report" if a.prev_report else "—"],
    ]))
    L.append("\n---\n")
    L.append("## Key takeaways\n")
    L.append("<!-- TODO(analyst): 3–5 takeaways, each pointing to a section below. -->\n")
    L.append("1. TODO\n2. TODO\n3. TODO\n")

    # I. Rounds at a glance
    L.append("## I. Rounds at a glance\n")
    rows = []
    for r in targets:
        xs = [x["awarded"] for x in tgt if x["round"] == r]
        m = rmeta.get(r, {})
        applied = int(money(m.get("applied"))) if m.get("applied") not in (None, "") else None
        rows.append([
            f"SCF #{r}", m.get("quarter", ""), applied if applied is not None else "—",
            len(xs), share(len(xs), applied) if applied else "—",
            usd(sum(xs)) if xs else "—", usd(st.mean(xs)) if xs else "—", usd(st.median(xs)) if xs else "—",
            share(sum(1 for v in xs if v >= MAX_ASK), len(xs)),
        ])
    bx = [x["awarded"] for x in base]
    rows.append([f"**History #{TRANCHE_ERA_START}–#{first - 1}**", "", "", len(bx), "",
                 usd(sum(bx)), usd(st.mean(bx)) if bx else "—", usd(st.median(bx)) if bx else "—",
                 share(sum(1 for v in bx if v >= MAX_ASK), len(bx))])
    L.append(table(["Round", "Quarter", "Applied", "Awarded", "Award rate", "Total awarded",
                    "Average", "Median", f"At max ask ({usd(MAX_ASK)})"], rows))
    empty = [r for r in targets if not any(x["round"] == r for x in tgt)]
    if empty:
        L.append(f"\n> ⚠️ No awards recorded for {', '.join(f'SCF #{r}' for r in empty)} in this data. "
                 "Check the SCF pipeline has run since those rounds closed before publishing.")
    L.append("\n**Observations:**\n\n- TODO(analyst)\n")

    # II. Returning projects
    L.append("## II. Returning projects\n")
    hist = defaultdict(list)
    key = lambda x: x["project_id"] or x["project"]
    for x in all_awards:
        hist[key(x)].append(x)
    rows = []
    for x in sorted(tgt, key=lambda x: (x["round"], x["project"])):
        prior = sorted((p for p in hist[key(x)] if p["round"] < x["round"]), key=lambda p: p["round"])
        if not prior or not key(x):
            continue
        last = prior[-1]
        lifetime = sum(p["awarded"] for p in prior)
        rows.append([
            f"**{x['project']}**", f"SCF #{x['round']}", ", ".join(f"#{p['round']}" for p in prior),
            usd(lifetime), f"{last['completion']:.0f}%" if last["completion"] is not None and last["build"] else "n/a (pre-tranche)",
            usd(x["awarded"]), usd(lifetime + x["awarded"]),
        ])
    if rows:
        L.append(table(["Project", "Awarded in", "Prior rounds", "Prior awarded",
                        "Last prior tranche completion", "New award", "Lifetime"], rows))
    else:
        L.append("_No returning projects among the awards in these rounds._")
    L.append(f"\n{len(rows)} of {len(tgt)} awards in these rounds went to projects funded before.\n")
    L.append("_Projects are matched by DAOIP-5 `projectId`. IDs are derived from Airtable names, so "
             "renamed projects may be missed (see `docs/data-quality/scf_canonical_id_data_loss_report_2026-10-09.md`)._\n")
    L.append("**Observations:**\n\n- TODO(analyst)\n")

    # III. Funding distribution
    L.append("## III. Funding distribution\n")
    eras = [(f"Pre-tranche (< #{TRANCHE_ERA_START}, all award types)", pre),
            (f"Tranche era #{TRANCHE_ERA_START}–#{first - 1}", base),
            (f"SCF {title_rounds}", tgt)]
    L.append(table(["Era", "Awards", "Average", "Median"],
                   [[n, len(g), usd(st.mean([x["awarded"] for x in g])) if g else "—",
                     usd(st.median([x["awarded"] for x in g])) if g else "—"] for n, g in eras]))
    L.append(f"\n### Award size vs. delivery (SCF #{TRANCHE_ERA_START}–#{first - 1})\n")
    br = [("Under $50,000", 0, 50_000), ("$50,000 – $99,999", 50_000, 100_000), ("$100,000 and above", 100_000, 1e12)]
    rows = []
    for name, lo, hi in br + [("**All**", 0, 1e12)]:
        g = [x for x in base if lo <= x["awarded"] < hi and x["completion"] is not None]
        rows.append([name, len(g), share(sum(1 for x in g if x["completion"] >= 100), len(g)),
                     f"{st.mean(x['completion'] for x in g):.0f}%" if g else "—"])
    L.append(table(["Award size", "Awards", "Fully complete (100%)", "Average tranche completion"], rows))
    L.append("\n**Observations:**\n\n- TODO(analyst)\n")

    # IV. Categories
    L.append("## IV. Category breakdown\n")
    L.append(f"### History (SCF #{TRANCHE_ERA_START}–#{first - 1})\n")
    cats = sorted({x["category"] for x in base}, key=lambda c: -sum(x["awarded"] for x in base if x["category"] == c))
    tot_b = sum(x["awarded"] for x in base) or 1
    rows = []
    for c in cats:
        g = [x for x in base if x["category"] == c]
        gc = [x for x in g if x["completion"] is not None]
        rows.append([c, len(g), usd(sum(x["awarded"] for x in g)), usd(st.mean(x["awarded"] for x in g)),
                     share(sum(1 for x in gc if x["completion"] >= 100), len(gc)),
                     f"{st.mean(x['completion'] for x in gc):.0f}%" if gc else "—"])
    L.append(table(["Category", "Awards", "Total awarded", "Average", "Fully complete", "Average completion"], rows))
    L.append(f"\n### SCF {title_rounds} vs. history\n")
    tot_t = sum(x["awarded"] for x in tgt) or 1
    allc = sorted({x["category"] for x in tgt} | set(cats))
    rows = []
    for c in allc:
        g = [x for x in tgt if x["category"] == c]
        hb = sum(x["awarded"] for x in base if x["category"] == c)
        rows.append([c, len(g), usd(sum(x["awarded"] for x in g)), share(sum(x["awarded"] for x in g), tot_t),
                     share(hb, tot_b)])
    L.append(table(["Category", "Awards", "Total awarded", "Share of these rounds", "Historical share"], rows))
    L.append("\n**Observations:**\n\n- TODO(analyst)\n")

    # V. Tranche trends
    L.append("## V. Tranche completion by round\n")
    L.append("_Recent rounds are still mid-delivery, so lower completion there is expected._\n")
    rows = []
    for r in sorted({x["round"] for x in awards if x["round"] >= TRANCHE_ERA_START}):
        g = [x for x in awards if x["round"] == r and x["completion"] is not None]
        if not g:
            continue
        rows.append([f"SCF #{r}", len(g), share(sum(1 for x in g if x["completion"] >= 100), len(g)),
                     f"{st.mean(x['completion'] for x in g):.0f}%",
                     share(sum(1 for x in g if not x["completion"]), len(g))])
    L.append(table(["Round", "Awards", "Fully complete", "Average completion", "No tranche paid yet"], rows))
    L.append("\n**Observations:**\n\n- TODO(analyst)\n")

    if a.prev_report:
        L.append(f"## VI. Since the SCF #{a.prev_report} report\n")
        L.append("- TODO(analyst): what moved since the last report, and follow-ups on what it flagged.\n")

    # Data quality
    orphans = [x for x in all_awards if x["round"] in targets and x["project_id"] not in data["project_ids"]]
    L.append("## Data quality and caveats\n")
    L.append(f"- Data as of {snap_date}. Rounds still voting or paying out at that date are partial.")
    L.append(f"- Awards in these rounds whose `projectId` has no row in `silver_scf_projects`: {len(orphans)}"
             + (f" ({usd(sum(x['awarded'] for x in orphans))})." if orphans else "."))
    g, sv = data["gold"], data["silver_totals"]
    if g and sv:
        ok = g["applications"] == sv["applications"] and abs(g["funding"] - sv["funding"]) < 1
        L.append(f"- Gold reconciliation (`{g['schema']}.gold__scf_system_profile`): gold reports "
                 f"{g['applications']} applications / {usd(g['funding'])} vs silver {sv['applications']} / "
                 f"{usd(sv['funding'])} — " + ("✅ match." if ok else "⚠️ mismatch: rerun dbt before publishing."))
    elif sv:
        L.append("- Gold reconciliation: `gold__scf_system_profile` not found; run dbt before publishing.")
    L.append("- Tables count Build awards only. Earlier award types (Activation, Community, Legacy) count "
             "as prior funding history in section II and in the pre-tranche row of section III.")
    L.append("- Project identity follows Airtable names, which change; see the ID stability report.\n")

    L.append("## Methodology\n")
    L.append(f"- **Cohort:** Build awards with awarded amount > 0. History = SCF #{TRANCHE_ERA_START} "
             f"(tranche structure introduced) to #{first - 1}.")
    L.append("- **Fully complete:** tranche completion = 100%. **Average completion:** mean tranche completion %.")
    L.append(f"- **Max ask:** award ≥ {usd(MAX_ASK)}.")
    L.append("- **Source tables:** `silver_scf_grant_applications` (awards), `silver_scf_grant_pools` "
             "(rounds, applied counts), `silver_scf_projects` (project IDs), `gold__scf_system_profile` (totals check).")
    L.append("- **Reproduce:** `DATABASE_URL=... python3 scripts/scf_intelligence_report.py --rounds "
             + " ".join(str(r) for r in targets) + (f" --prev-report {a.prev_report}" if a.prev_report else "") + "`")
    print("\n".join(L))


if __name__ == "__main__":
    main()
