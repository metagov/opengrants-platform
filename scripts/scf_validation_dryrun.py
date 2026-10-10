#!/usr/bin/env python3
"""Dry-run the SCF accuracy gate against a live datalake, without writing anything.

Builds candidate silver tables from the current bronze tables (exactly as the
`silver_scf_validation_gate` asset does), runs the same checks against the live silver tables, and
prints what the gate would decide. Nothing is written: no silver tables, no `scf_validation_runs`
row, no report file. Read-only database access is enough.

Use it before deploying a change to the SCF pipeline, to check the gate won't block good data.

    DATABASE_URL=<read-only URL> python3 scripts/scf_validation_dryrun.py

Before the createdAt change (PR #3) is deployed, production bronze has no
`_airtable_created_time`, so `createdAt` comes out empty. The gate reports that as a warning, not a
block, until the next bronze run fills it.
"""
import contextlib
import io
import os
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "og_dagster"))

from sqlalchemy import create_engine, text  # noqa: E402

import utils.translate_to_silver as tts  # noqa: E402
from utils.graphql_helpers import sanitize_for_sql  # noqa: E402
from utils.scf_validation import SECTIONS, render_report, validate_scf_candidates  # noqa: E402

SCHEMA_PATH = ROOT / "og_dagster/configs/schema_maps/active/daoip5_scf.yaml"

# The pipeline passes raw SQL strings; SQLAlchemy 2 needs text().
_read = tts.safe_read_query
tts.safe_read_query = lambda conn, q: _read(conn, text(q) if isinstance(q, str) else q)


def main():
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("set DATABASE_URL (read-only access is enough)")
    engine = create_engine(re.sub(r"^postgres(ql)?(\+\w+)?://", "postgresql+psycopg2://", url))

    frames = {}
    for section in SECTIONS:
        with contextlib.redirect_stdout(io.StringIO()):
            df, _ = tts.build_silver(engine=engine, schema_path=str(SCHEMA_PATH), section=section)
        frames[section] = sanitize_for_sql(df)

    result = validate_scf_candidates(engine, frames)

    status = "passed" if result.passed else "blocked"
    report = render_report(result, "dry-run (nothing written)", status)
    report = report.replace("✅ Passed — published", "✅ Would pass (dry run)").replace(
        "⛔ Blocked — live data unchanged", "⛔ Would block (dry run)")
    print(report)
    print(f"Dry run: the gate would have {'PUBLISHED' if result.passed else 'BLOCKED'} this data.")
    sys.exit(0 if result.passed else 1)


if __name__ == "__main__":
    main()
