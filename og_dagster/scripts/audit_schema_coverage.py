#!/usr/bin/env python3
"""
audit_schema_coverage.py

Compares bronze table columns (from Postgres) against silver schema maps (YAML)
and reports any bronze columns that are not mapped to a silver field.

Usage:
    python og_dagster/scripts/audit_schema_coverage.py

Requires DATABASE_URL or POSTGRES_* env vars (loads .env automatically).
"""

import os
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect, text

# ── Load env ──────────────────────────────────────────────────────────────────
ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env.local", override=False)
load_dotenv(ROOT / ".env", override=False)

DATABASE_URL = os.getenv("DATABASE_URL")
if DATABASE_URL:
    if DATABASE_URL.startswith("postgresql://"):
        DATABASE_URL = DATABASE_URL.replace("postgresql://", "postgresql+psycopg2://", 1)
    engine = create_engine(DATABASE_URL)
else:
    user = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    host = os.getenv("POSTGRES_HOST", "postgres")
    port = os.getenv("POSTGRES_PORT", "5432")
    db = os.getenv("POSTGRES_DB", "opengrants")
    engine = create_engine(f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db}")

SCHEMA_DIR = ROOT / "og_dagster" / "configs" / "schema_maps" / "active"

# ── Helpers ───────────────────────────────────────────────────────────────────

def get_bronze_columns(table_name: str) -> list[str]:
    """Return column names for a bronze table, or empty list if table missing."""
    insp = inspect(engine)
    if not insp.has_table(table_name):
        return []
    return [c["name"] for c in insp.get_columns(table_name)]


def collect_mapped_sources(schema_section: dict) -> set[str]:
    """Recursively collect all source values from a schema section."""
    sources = set()

    def _recurse(d):
        if isinstance(d, dict):
            if "source" in d:
                v = d["source"]
                if v and v != "null" and v is not None:
                    if isinstance(v, list):
                        for s in v:
                            sources.add(str(s))
                    else:
                        sources.add(str(v))
            for val in d.values():
                _recurse(val)
        elif isinstance(d, list):
            for item in d:
                _recurse(item)

    _recurse(schema_section)
    return sources


def audit_schema(schema_path: Path) -> dict:
    """Return gap report for a single schema file."""
    with open(schema_path) as f:
        schema = yaml.safe_load(f)

    results = {}
    for section_name, section in schema.get("schemas", {}).items():
        bronze_table = section.get("table") or section.get("sources", [None])[0]
        if not bronze_table:
            continue

        # Handle list-form table
        if isinstance(bronze_table, list):
            bronze_table = bronze_table[0]

        # Strip schema prefix (e.g. "public.bronze_scf_projects")
        if "." in str(bronze_table):
            bronze_table = bronze_table.split(".")[-1]

        bronze_cols = get_bronze_columns(bronze_table)
        if not bronze_cols:
            results[section_name] = {
                "table": bronze_table,
                "status": "TABLE_MISSING",
                "unmapped": [],
            }
            continue

        mapped_sources = collect_mapped_sources(section)
        unmapped = [c for c in bronze_cols if c not in mapped_sources]

        results[section_name] = {
            "table": bronze_table,
            "status": "OK" if not unmapped else "GAPS",
            "total_bronze": len(bronze_cols),
            "mapped": len(bronze_cols) - len(unmapped),
            "unmapped": unmapped,
        }

    return results


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    schema_files = sorted(SCHEMA_DIR.glob("*.yaml"))
    if not schema_files:
        print(f"No schema files found in {SCHEMA_DIR}")
        sys.exit(1)

    any_gaps = False

    for schema_path in schema_files:
        print(f"\n{'═' * 60}")
        print(f"Schema: {schema_path.name}")
        print(f"{'═' * 60}")

        report = audit_schema(schema_path)
        for section, info in report.items():
            status = info["status"]
            table = info["table"]

            if status == "TABLE_MISSING":
                print(f"\n  [{section}] → {table}")
                print(f"    ⚠️  Table not found in DB (pipeline not run yet?)")
                continue

            total = info["total_bronze"]
            mapped = info["mapped"]
            unmapped = info["unmapped"]
            coverage = round(100 * mapped / total, 1) if total else 0

            icon = "✅" if not unmapped else "❌"
            print(f"\n  {icon} [{section}] → {table}")
            print(f"     Coverage: {mapped}/{total} columns ({coverage}%)")

            if unmapped:
                any_gaps = True
                print(f"     Unmapped bronze columns ({len(unmapped)}):")
                for col in unmapped:
                    print(f"       - {col}")

    print(f"\n{'═' * 60}")
    if any_gaps:
        print("RESULT: ❌ Gaps found — add missing columns to schema maps")
        sys.exit(1)
    else:
        print("RESULT: ✅ All bronze columns are mapped")
        sys.exit(0)


if __name__ == "__main__":
    main()
