#!/usr/bin/env python3
"""List SCF awards where more was paid than awarded, from the production silver tables.

Reads only the live datalake (never the CSV exports in raw_data/). Read-only access is enough.

Usage:
    DATABASE_URL=postgresql://report_reader:...@host:25060/defaultdb?sslmode=require \\
        python3 scripts/scf_paid_over_award.py [--out docs/data-quality/scf_paid_over_award_YYYY-MM-DD.md]
"""
import argparse
import os
import re
import sys
from datetime import datetime, timezone

from sqlalchemy import create_engine, text

TOLERANCE = 1.005  # same as the dashboard flag and the accuracy gate

APPS = """
SELECT "projectId", name, "grantPoolName",
       CAST("fundsApprovedInUSD" AS FLOAT) AS awarded,
       CAST("org.stellar.communityfund.totalPaidUSD" AS FLOAT) AS paid
FROM silver_scf_grant_applications
WHERE CAST("org.stellar.communityfund.totalPaidUSD" AS FLOAT)
      > CAST("fundsApprovedInUSD" AS FLOAT) * :tol
"""
PROJECTS = """
SELECT id, name,
       CAST("org.stellar.communityfund.totalAwardedUSD" AS FLOAT) AS awarded,
       CAST("org.stellar.communityfund.totalPaidUSD" AS FLOAT) AS paid
FROM silver_scf_projects
WHERE CAST("org.stellar.communityfund.totalPaidUSD" AS FLOAT)
      > CAST("org.stellar.communityfund.totalAwardedUSD" AS FLOAT) * :tol
"""


def engine_from_env():
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("set DATABASE_URL to the production OpenGrants datalake (read-only user is enough)")
    url = re.sub(r"^postgres(ql)?(\+\w+)?://", "postgresql+psycopg2://", url)
    return create_engine(url)


def money(v):
    return f"${v:,.0f}" if v is not None else "—"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", help="also write the report to this markdown file")
    a = ap.parse_args()

    eng = engine_from_env()
    with eng.connect() as c:
        apps = c.execute(text(APPS), {"tol": TOLERANCE}).all()
        projects = c.execute(text(PROJECTS), {"tol": TOLERANCE}).all()
        apps = sorted(apps, key=lambda r: r[4] - r[3], reverse=True)
        projects = sorted(projects, key=lambda r: r[3] - r[2], reverse=True)
        total_apps = c.execute(text("SELECT COUNT(*) FROM silver_scf_grant_applications")).scalar()

    excess = sum(p - w for _, _, _, w, p in apps)
    lines = [
        "# SCF awards with more paid than awarded (production)", "",
        f"Generated {datetime.now(timezone.utc):%Y-%m-%d %H:%M UTC} from the live `silver_scf_*` tables.", "",
        f"- **{len(apps)}** of {total_apps} applications, **{money(excess)}** paid above award in total.",
        f"- **{len(projects)}** projects with project-level paid above awarded.", "",
        "## Applications", "",
        "| Project | Application | Round | Awarded | Paid | Over by | Paid / awarded |",
        "|---|---|---|---|---|---|---|",
    ]
    for pid, name, rnd, w, p in apps:
        ratio = f"{p / w:.2f}×" if w else "—"
        lines.append(f"| `{(pid or '').split(':')[-1]}` | {name} | {rnd} | {money(w)} | {money(p)} | {money(p - w)} | {ratio} |")
    lines += ["", "## Projects", "",
              "| Project | Awarded | Paid | Over by |", "|---|---|---|---|"]
    for pid, name, w, p in projects:
        lines.append(f"| {name} (`{pid.split(':')[-1]}`) | {money(w)} | {money(p)} | {money(p - w)} |")

    report = "\n".join(lines) + "\n"
    print(report)
    if a.out:
        with open(a.out, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"written to {a.out}", file=sys.stderr)


if __name__ == "__main__":
    main()
