#!/usr/bin/env python3
"""DAOIP-5 round-level compliance for SCF, computed from the OpenGrants datalake.

Companion to scripts/daoip5_compliance_check.py (field-level, reads the schema maps).
This one answers: of the SCF rounds that have finished, how many are fully available in
DAOIP-5 form in silver?

Usage:
    DATABASE_URL=postgresql://... python3 scripts/daoip5_round_compliance.py > report_section.md

A round is classified from silver_scf_grant_pools plus its awards in
silver_scf_grant_applications:
    finished     awards recorded (awarded amount > 0)
    in progress  submissions applied, no awards yet
    future       no submissions
A finished round is compliant when its grant pool carries every DAOIP-5 required field
(id, name, description, grantFundingMechanism, isOpen, totalGrantPoolSizeInUSD) and every
one of its awards resolves to it by grantPoolId and has the required application fields
(id, grantPoolId, projectId, createdAt).
"""
import datetime as dt
import os
import re
import sys

from sqlalchemy import create_engine, text

EXT = "org.stellar.communityfund."
POOL_REQUIRED = ["id", "name", "description", "grantFundingMechanism", "isOpen", "totalGrantPoolSizeInUSD"]
APP_REQUIRED = ["id", "grantPoolId", "projectId", "createdAt"]


def rnum(name):
    m = re.search(r"#\s*(\d+)", name or "")
    return int(m.group(1)) if m else -1


def blank(v):
    return v is None or str(v).strip() == ""


def main():
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("set DATABASE_URL to the OpenGrants datalake")
    # Pin the psycopg2 driver: newer SQLAlchemy defaults plain postgresql:// to psycopg 3.
    url = re.sub(r"^postgres(ql)?(\+\w+)?://", "postgresql+psycopg2://", url)
    eng = create_engine(url)
    q = lambda c: ", ".join(f'"{x}"' for x in c)
    with eng.connect() as c:
        pools = c.execute(text(
            f'SELECT {q(POOL_REQUIRED)}, "{EXT}appliedSubmissions" AS applied FROM silver_scf_grant_pools'
        )).mappings().all()
        apps = c.execute(text(
            f'SELECT {q(APP_REQUIRED)}, "{EXT}totalAwardedUSD" AS awarded, "{EXT}totalPaidUSD" AS paid '
            "FROM silver_scf_grant_applications"
        )).mappings().all()

    by_pool = {}
    for a in apps:
        by_pool.setdefault(a["grantPoolId"], []).append(a)

    rows, totals = [], {"finished": 0, "in progress": 0, "future": 0, "compliant": 0}
    awarded_ok = paid_ok = 0.0
    for p in sorted(pools, key=lambda p: -rnum(p["name"])):
        awards = [a for a in by_pool.get(p["id"], []) if (a["awarded"] or 0) > 0]
        applied = int(float(p["applied"])) if not blank(p["applied"]) else 0
        status = "finished" if awards else ("in progress" if applied else "future")
        totals[status] += 1
        missing_pool = [f for f in POOL_REQUIRED if blank(p[f])]
        bad_apps = sum(1 for a in awards if any(blank(a[f]) for f in APP_REQUIRED))
        ok = status == "finished" and not missing_pool and not bad_apps
        if ok:
            totals["compliant"] += 1
            awarded_ok += sum(a["awarded"] or 0 for a in awards)
            paid_ok += sum(a["paid"] or 0 for a in awards)
        gaps = []
        if missing_pool:
            gaps.append("pool missing " + ", ".join(f"`{f}`" for f in missing_pool))
        if bad_apps:
            gaps.append(f"{bad_apps} award(s) missing required fields")
        rows.append([p["name"], status, len(awards), "✅" if ok else ("—" if status != "finished" else "❌"),
                     "; ".join(gaps) or ""])

    fin = totals["finished"]
    print(f"### SCF round-level compliance (datalake, {dt.date.today().isoformat()})\n")
    print(f"- **Rounds in silver:** {len(pools)} ({fin} finished, {totals['in progress']} in progress, "
          f"{totals['future']} future)")
    print(f"- **Compliant finished rounds:** {totals['compliant']} / {fin} = "
          f"**{totals['compliant'] / fin:.0%}**" if fin else "- No finished rounds.")
    print(f"- **Funding in compliant rounds:** ${awarded_ok:,.2f} awarded / ${paid_ok:,.2f} paid\n")
    print("| Round | Status | Awards | Compliant | Gaps |")
    print("| --- | --- | --- | --- | --- |")
    for r in rows:
        print("| " + " | ".join(str(x) for x in r) + " |")
    print("\n_Compliant = DAOIP-5 required grant pool fields present, and every award resolves to its "
          "pool with required application fields (id, grantPoolId, projectId, createdAt)._")


if __name__ == "__main__":
    main()
