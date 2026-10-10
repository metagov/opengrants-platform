#!/usr/bin/env python3
"""List, export or restore SCF bronze snapshots from the pipeline archive.

The archive (og_dagster/utils/scf_archive.py) keeps every distinct Airtable payload the SCF
bronze asset loaded. This script reads it back.

Usage (DATABASE_URL points at the datalake; read-only access is enough for --list/--export):
    python3 scripts/scf_archive_restore.py --list
    python3 scripts/scf_archive_restore.py --export raw_data/SCF/10_October_2026 [--at 2026-10-10T12:00]
    python3 scripts/scf_archive_restore.py --restore [--at ...]            # writes <table>_restored
    python3 scripts/scf_archive_restore.py --restore --in-place [--at ...]  # overwrites bronze_scf_*

--at picks, per table, the latest snapshot taken at or before that time (default: latest).
--export writes CSVs named like the Airtable exports in raw_data/SCF/, so existing tooling
(scf_id_audit.py, scf_intelligence_report.py --snapshot) can read them.
"""
import argparse
import csv
import json
import os
import re
import sys
from pathlib import Path

from sqlalchemy import create_engine, text

SNAPSHOTS = "archive_scf_bronze_snapshots"
EXPORT_NAMES = {
    "bronze_scf_projects": "Awarded Projects [Build only]",
    "bronze_scf_submissions": "Awarded Submissions [Build only]",
    "bronze_scf_rounds": "Build Award Rounds",
}


def engine_from_env():
    url = os.environ.get("DATABASE_URL")
    if not url:
        sys.exit("set DATABASE_URL to the OpenGrants datalake")
    if url.startswith(("postgres://", "postgresql")):
        url = re.sub(r"^postgres(ql)?(\+\w+)?://", "postgresql+psycopg2://", url)
    return create_engine(url)


def pick(conn, at):
    rows = conn.execute(text(
        f"SELECT table_name, snapshot_at, record_count, content_sha256, payload FROM {SNAPSHOTS} "
        + ("WHERE snapshot_at <= :at " if at else "")
        + "ORDER BY table_name, snapshot_at"
    ), {"at": at} if at else {}).all()
    latest = {}
    for r in rows:
        latest[r[0]] = r
    return latest


def main():
    ap = argparse.ArgumentParser()
    g = ap.add_mutually_exclusive_group(required=True)
    g.add_argument("--list", action="store_true")
    g.add_argument("--export", metavar="DIR")
    g.add_argument("--restore", action="store_true")
    ap.add_argument("--at", help="ISO timestamp; use the latest snapshot at or before it")
    ap.add_argument("--in-place", action="store_true", help="with --restore, overwrite bronze_scf_* tables")
    a = ap.parse_args()

    eng = engine_from_env()
    with eng.connect() as conn:
        if a.list:
            for t, at, n, h in conn.execute(text(
                f"SELECT table_name, snapshot_at, record_count, content_sha256 FROM {SNAPSHOTS} ORDER BY snapshot_at"
            )):
                print(f"{at}  {t:<24} {n:>5} records  {h[:12]}")
            return
        chosen = pick(conn, a.at)

    if not chosen:
        sys.exit("no snapshots found" + (f" at or before {a.at}" if a.at else ""))

    for table, (_, at, n, h, payload) in sorted(chosen.items()):
        records = json.loads(payload)
        if a.export:
            out = Path(a.export)
            out.mkdir(parents=True, exist_ok=True)
            cols = sorted({k for r in records for k in r})
            f = out / f"{EXPORT_NAMES.get(table, table)} {out.name}.csv"
            with open(f, "w", newline="", encoding="utf-8") as fh:
                w = csv.DictWriter(fh, fieldnames=cols)
                w.writeheader()
                w.writerows(records)
            print(f"exported {table} ({n} records, snapshot {at}) -> {f}")
        else:
            import polars as pl

            target = table if a.in_place else f"{table}_restored"
            df = pl.DataFrame(records, infer_schema_length=None)
            if "_airtable_id" in df.columns and a.in_place:
                df = df.drop("_airtable_id")  # bronze never stores it; the archive keeps it
            with eng.begin() as conn:
                conn.execute(text(f'DROP TABLE IF EXISTS "{target}" CASCADE'))
            df.write_database(target, eng, if_table_exists="replace")
            print(f"restored {table} ({n} records, snapshot {at}) -> {target}")


if __name__ == "__main__":
    main()
