#!/usr/bin/env python3
"""
audit_type_translations.py

Audits field type consistency across bronze → silver → gold layers.

Phase 1 — Schema declared type vs actual silver column type
    For each field in active schema map YAMLs, maps the declared type to the
    expected Postgres type and compares against what is actually in the silver table.

    Flags:
      MISMATCH      — declared type and actual PG type are incompatible
      NULL_COLUMN   — silver column is all-null (TEXT); source: null or all-null bronze values
                      mean the declared type was lost at write time
      SIDEEFFECT    — an undeclared _currency TEXT column was injected by the
                      parse_money_amount_and_token() helper for a float field
      DATETIME_TEXT — datetime field stored as TEXT (known limitation of
                      normalize_type; flagged as advisory, not an error)

Phase 2 — Silver actual type vs gold actual type
    Reads every gold SQL file, extracts silver column references, checks whether
    an explicit Postgres cast (::type) is present, and compares silver vs gold types.

    Flags:
      IMPLICIT_CAST   — silver and gold types differ but the SQL has no explicit cast
                        (Postgres will coerce silently, which may fail or truncate)
      EXPLICIT_CAST   — types differ AND the SQL has a cast; healthy but documented
      GOLD_UNCHANGED  — types match across layers; no cast needed or used

Usage:
    python og_dagster/scripts/audit_type_translations.py

Requires DATABASE_URL or POSTGRES_* env vars (loads .env automatically).
"""

import os
import re
import sys
from pathlib import Path

import yaml
from dotenv import load_dotenv
from sqlalchemy import create_engine, inspect

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
    user     = os.getenv("POSTGRES_USER", "postgres")
    password = os.getenv("POSTGRES_PASSWORD", "postgres")
    host     = os.getenv("POSTGRES_HOST", "postgres")
    port     = os.getenv("POSTGRES_PORT", "5432")
    db       = os.getenv("POSTGRES_DB", "opengrants")
    engine   = create_engine(f"postgresql+psycopg2://{user}:{password}@{host}:{port}/{db}")

SCHEMA_DIR = ROOT / "og_dagster" / "configs" / "schema_maps" / "active"
GOLD_DIR   = ROOT / "dbt_project" / "models" / "gold"

# ── Type mapping ──────────────────────────────────────────────────────────────
# Maps each DAOIP-5 schema declared type to the set of acceptable PG column types.
# Polars uses upper-case type names when writing to Postgres.
SCHEMA_TO_PG = {
    "string":   {"TEXT", "VARCHAR", "CHARACTER VARYING"},
    "json":     {"TEXT", "JSON", "JSONB"},
    "enum":     {"TEXT", "VARCHAR"},
    "datetime": {"TIMESTAMP", "TIMESTAMP WITHOUT TIME ZONE", "TIMESTAMP WITH TIME ZONE",
                 "TIMESTAMPTZ", "DATE", "TEXT"},   # TEXT is expected — see DATETIME_TEXT flag
    "float":    {"DOUBLE_PRECISION", "FLOAT", "FLOAT8", "NUMERIC", "REAL"},
    "number":   {"DOUBLE_PRECISION", "FLOAT", "FLOAT8", "NUMERIC", "REAL"},
    "integer":  {"BIGINT", "INTEGER", "INT", "SMALLINT", "INT4", "INT8", "INT2"},
    "int":      {"BIGINT", "INTEGER", "INT", "SMALLINT", "INT4", "INT8", "INT2"},
    "boolean":  {"BOOLEAN", "BOOL"},
}

# PG types produced by normalize_type() for each schema type
EXPECTED_PG = {
    "string":   "TEXT",
    "json":     "TEXT",
    "enum":     "TEXT",
    "datetime": "TEXT",       # normalize_type returns str() — no real timestamp
    "float":    "DOUBLE_PRECISION",
    "number":   "DOUBLE_PRECISION",
    "integer":  "BIGINT",
    "int":      "BIGINT",
    "boolean":  "BOOLEAN",
}


# ── Helpers ───────────────────────────────────────────────────────────────────

def get_table_columns(table_name: str, schema: str = "public") -> dict[str, str]:
    """Return {col_name: pg_type_str} for a table, or {} if missing."""
    insp = inspect(engine)
    if not insp.has_table(table_name, schema=schema):
        return {}
    return {
        c["name"]: str(c["type"]).upper().strip()
        for c in insp.get_columns(table_name, schema=schema)
    }


def collect_fields(schema_section: dict) -> dict[str, dict]:
    """
    Return a flat dict of {silver_col_name: field_config} for all fields
    in a schema section (base fields + namespaced extension fields).
    """
    out = {}
    for field, cfg in schema_section.get("fields", {}).items():
        out[field] = cfg
    for ns, ext_fields in schema_section.get("extensions", {}).items():
        for field, cfg in ext_fields.items():
            out[f"{ns}.{field}"] = cfg
    return out


def pg_type_base(pg_type_str: str) -> str:
    """Normalise a PG type string for comparison (strip precision/scale)."""
    return re.sub(r"\(.*\)", "", pg_type_str).strip().upper()


# ── Phase 1 — Schema declared type vs silver actual type ─────────────────────

def audit_bronze_to_silver(schema_path: Path) -> list[dict]:
    with open(schema_path) as f:
        schema = yaml.safe_load(f)

    findings = []

    for section_name, section in schema.get("schemas", {}).items():
        target_table = section.get("target_table")
        if not target_table:
            continue

        silver_cols = get_table_columns(target_table)
        if not silver_cols:
            findings.append({
                "layer":   "bronze→silver",
                "schema":  schema_path.name,
                "section": section_name,
                "table":   target_table,
                "field":   "—",
                "declared_type": "—",
                "actual_pg":     "—",
                "flag":    "TABLE_MISSING",
                "note":    "Silver table not in DB (pipeline not run?)",
            })
            continue

        all_fields = collect_fields(section)

        # Collect float fields so we can check for _currency sideeffects
        float_fields = {
            fname for fname, cfg in all_fields.items()
            if cfg.get("type", "string") in ("float", "number")
            and cfg.get("source") not in (None, "null")
        }

        for col_name, pg_type_str in silver_cols.items():
            pg_base = pg_type_base(pg_type_str)

            # ── _currency sideeffect column ──────────────────────────────────
            if col_name.endswith("_currency"):
                base_field = col_name[: -len("_currency")]
                if base_field in float_fields:
                    findings.append({
                        "layer":   "bronze→silver",
                        "schema":  schema_path.name,
                        "section": section_name,
                        "table":   target_table,
                        "field":   col_name,
                        "declared_type": "(undeclared)",
                        "actual_pg":     pg_base,
                        "flag":    "SIDEEFFECT",
                        "note":    (
                            f"Injected by parse_money_amount_and_token() for float field "
                            f"'{base_field}'. Not declared in schema map."
                        ),
                    })
                continue

            # ── Look up declared type for this column ────────────────────────
            if col_name not in all_fields:
                continue  # unmapped — covered by audit_schema_coverage.py

            cfg = all_fields[col_name]
            declared_type = cfg.get("type", "string")
            source        = cfg.get("source")

            acceptable_pg = SCHEMA_TO_PG.get(declared_type, {"TEXT"})

            # ── NULL_COLUMN — source: null produces all-null TEXT column ─────
            if source in (None, "null"):
                if pg_base == "TEXT":
                    findings.append({
                        "layer":   "bronze→silver",
                        "schema":  schema_path.name,
                        "section": section_name,
                        "table":   target_table,
                        "field":   col_name,
                        "declared_type": declared_type,
                        "actual_pg":     pg_base,
                        "flag":    "NULL_COLUMN",
                        "note":    (
                            f"source: null — value is always NULL; Polars writes "
                            f"null-only column as TEXT regardless of declared type. "
                            f"Gold SQL must cast explicitly if non-TEXT type is needed."
                        ),
                    })
                # If it's somehow not TEXT (unlikely), fall through to MISMATCH check
                else:
                    if pg_base not in acceptable_pg:
                        findings.append({
                            "layer":   "bronze→silver",
                            "schema":  schema_path.name,
                            "section": section_name,
                            "table":   target_table,
                            "field":   col_name,
                            "declared_type": declared_type,
                            "actual_pg":     pg_base,
                            "flag":    "MISMATCH",
                            "note":    (
                                f"Expected one of {sorted(acceptable_pg)}, "
                                f"got {pg_base}."
                            ),
                        })
                continue

            # ── DATETIME_TEXT — advisory only ────────────────────────────────
            if declared_type == "datetime" and pg_base == "TEXT":
                findings.append({
                    "layer":   "bronze→silver",
                    "schema":  schema_path.name,
                    "section": section_name,
                    "table":   target_table,
                    "field":   col_name,
                    "declared_type": declared_type,
                    "actual_pg":     pg_base,
                    "flag":    "DATETIME_TEXT",
                    "note":    (
                        "normalize_type() returns str() for datetime — column is "
                        "stored as TEXT. Gold SQL must cast to ::timestamp when "
                        "date arithmetic is needed."
                    ),
                })
                continue

            # ── MISMATCH — actual PG type not in acceptable set ──────────────
            if pg_base not in acceptable_pg:
                findings.append({
                    "layer":   "bronze→silver",
                    "schema":  schema_path.name,
                    "section": section_name,
                    "table":   target_table,
                    "field":   col_name,
                    "declared_type": declared_type,
                    "actual_pg":     pg_base,
                    "flag":    "MISMATCH",
                    "note":    (
                        f"Expected one of {sorted(acceptable_pg)}, got {pg_base}."
                    ),
                })

    return findings


# ── Phase 2 — Silver actual type vs gold actual type ─────────────────────────

def parse_gold_sql_column_refs(sql: str) -> dict[str, str | None]:
    """
    Parse a gold SQL file and return:
        {silver_col_name: cast_type_or_None}

    Patterns matched:
        "col_name"::sometype   →  cast_type = "sometype"
        "col_name"             →  cast_type = None
        col_name::sometype     →  cast_type = "sometype"  (unquoted)
        col_name               →  cast_type = None         (unquoted)

    Returns each unique column reference once (with cast taking precedence over no-cast).
    """
    refs: dict[str, str | None] = {}

    # Quoted columns with optional cast: "col_name"(::type)?
    for m in re.finditer(r'"([^"]+)"(?:::([a-z_]+(?:\s+[a-z_]+)*))?', sql, re.IGNORECASE):
        col  = m.group(1)
        cast = m.group(2).upper().strip() if m.group(2) else None
        if col not in refs or cast is not None:
            refs[col] = cast

    # Unquoted simple identifiers with cast: identifier::type
    for m in re.finditer(r'\b([a-z_][a-z0-9_]*)::([a-z_]+(?:\s+[a-z_]+)?)', sql, re.IGNORECASE):
        col  = m.group(1)
        cast = m.group(2).upper().strip()
        if col not in refs or cast is not None:
            refs[col] = cast

    return refs


def audit_silver_to_gold() -> list[dict]:
    findings = []

    # Build a lookup: silver column → PG type, across ALL silver tables
    insp = inspect(engine)
    all_silver_cols: dict[str, dict[str, str]] = {}  # {table: {col: pg_type}}
    for tname in insp.get_table_names(schema="public"):
        if tname.startswith("silver_"):
            all_silver_cols[tname] = get_table_columns(tname)

    # Also need gold column types
    all_gold_cols: dict[str, dict[str, str]] = {}
    for tname in insp.get_table_names(schema="public"):
        if tname.startswith("gold_") or tname.startswith("gold__"):
            all_gold_cols[tname] = get_table_columns(tname)

    if not all_gold_cols:
        findings.append({
            "layer": "silver→gold",
            "file":  "—",
            "field": "—",
            "silver_pg": "—",
            "gold_pg":   "—",
            "flag":  "GOLD_MISSING",
            "note":  "No gold tables found in DB. Run dbt build first.",
        })
        return findings

    # Walk every .sql file in gold/
    for sql_path in sorted(GOLD_DIR.rglob("*.sql")):
        sql_text = sql_path.read_text()

        # Identify which silver tables this file reads
        silver_sources = re.findall(
            r"source\s*\(\s*['\"]silver['\"],\s*['\"]([^'\"]+)['\"]\s*\)",
            sql_text, re.IGNORECASE,
        )
        # Also match direct table refs like FROM silver_xxx
        silver_sources += re.findall(
            r"\bFROM\s+(silver_\w+)\b", sql_text, re.IGNORECASE
        )
        silver_sources = list(dict.fromkeys(silver_sources))  # deduplicate, preserve order

        if not silver_sources:
            continue

        # Derive matching gold table name from SQL filename
        gold_table_stem = sql_path.stem  # e.g. gold__all_projects
        gold_cols = all_gold_cols.get(gold_table_stem, {})

        # Parse all column references + casts from this SQL file
        col_refs = parse_gold_sql_column_refs(sql_text)

        # For each column referenced in the SQL, find its silver type
        for col_name, cast_type in col_refs.items():
            # Skip SQL keywords and non-column tokens
            if col_name.lower() in {
                "platform", "source", "true", "false", "null", "select",
                "from", "where", "join", "on", "as", "and", "or", "not",
                "inner", "left", "right", "outer", "union", "all", "distinct",
                "case", "when", "then", "else", "end", "coalesce", "nullif",
                "sum", "avg", "count", "min", "max", "round", "extract",
                "year", "quarter", "concat", "over", "order", "by", "asc",
                "desc", "group", "having", "limit", "offset", "with", "cte",
                "table", "view", "materialized", "config", "ref",
            }:
                continue

            # Find which silver table has this column
            silver_pg = None
            for stbl in silver_sources:
                stbl_cols = all_silver_cols.get(stbl, {})
                if col_name in stbl_cols:
                    silver_pg = pg_type_base(stbl_cols[col_name])
                    break

            if silver_pg is None:
                continue  # column not found in any referenced silver table

            # Find gold column type (gold renames columns, try direct match first)
            gold_pg = None
            if col_name in gold_cols:
                gold_pg = pg_type_base(gold_cols[col_name])
            else:
                # column was renamed in gold AS clause — try to find it by
                # reading the AS alias from the SQL
                alias_match = re.search(
                    rf'"{re.escape(col_name)}"(?:::[a-z_\s]+)?\s+(?:as\s+)?(\w+)',
                    sql_text, re.IGNORECASE,
                )
                if alias_match:
                    alias = alias_match.group(1).lower()
                    gold_pg = pg_type_base(gold_cols.get(alias, ""))

            if not gold_pg:
                continue  # couldn't match to a gold column — skip

            types_differ = silver_pg != gold_pg

            if not types_differ:
                findings.append({
                    "layer":    "silver→gold",
                    "file":     sql_path.name,
                    "field":    col_name,
                    "silver_pg": silver_pg,
                    "gold_pg":   gold_pg,
                    "flag":     "GOLD_UNCHANGED",
                    "note":     "Types match; no cast needed.",
                })
            elif cast_type:
                findings.append({
                    "layer":    "silver→gold",
                    "file":     sql_path.name,
                    "field":    col_name,
                    "silver_pg": silver_pg,
                    "gold_pg":   gold_pg,
                    "flag":     "EXPLICIT_CAST",
                    "note":     f"Silver={silver_pg} → Gold={gold_pg} via ::{cast_type}. Explicit — OK.",
                })
            else:
                findings.append({
                    "layer":    "silver→gold",
                    "file":     sql_path.name,
                    "field":    col_name,
                    "silver_pg": silver_pg,
                    "gold_pg":   gold_pg,
                    "flag":     "IMPLICIT_CAST",
                    "note":     (
                        f"Silver={silver_pg} → Gold={gold_pg} with no explicit "
                        f"::cast in SQL. Postgres may coerce silently or error at runtime."
                    ),
                })

    return findings


# ── Main ──────────────────────────────────────────────────────────────────────

def main():
    schema_files = sorted(SCHEMA_DIR.glob("*.yaml"))
    if not schema_files:
        print(f"No schema files found in {SCHEMA_DIR}")
        sys.exit(1)

    # ── Phase 1 ──────────────────────────────────────────────────────────────
    print(f"\n{'═' * 70}")
    print("PHASE 1 — Bronze → Silver type translations")
    print(f"{'═' * 70}")

    phase1_findings: list[dict] = []
    for schema_path in schema_files:
        phase1_findings.extend(audit_bronze_to_silver(schema_path))

    # Group by flag type for reporting
    flag_order = ["TABLE_MISSING", "MISMATCH", "NULL_COLUMN", "SIDEEFFECT", "DATETIME_TEXT"]
    by_flag: dict[str, list[dict]] = {f: [] for f in flag_order}
    for item in phase1_findings:
        by_flag.setdefault(item["flag"], []).append(item)

    flag_icons = {
        "TABLE_MISSING": "⚠️ ",
        "MISMATCH":      "❌",
        "NULL_COLUMN":   "🟡",
        "SIDEEFFECT":    "🔵",
        "DATETIME_TEXT": "ℹ️ ",
    }

    any_errors = False
    for flag in flag_order:
        items = by_flag.get(flag, [])
        if not items:
            continue
        icon = flag_icons.get(flag, "  ")
        print(f"\n{icon} {flag} ({len(items)} occurrence{'s' if len(items) != 1 else ''})")
        print(f"  {'─' * 66}")
        for item in items:
            print(f"  [{item['schema']}] {item['section']}.{item['field']}")
            print(f"    Declared: {item['declared_type']:<12}  Actual PG: {item['actual_pg']}")
            print(f"    {item['note']}")
        if flag == "MISMATCH":
            any_errors = True

    if not any_errors and not by_flag.get("TABLE_MISSING"):
        print("\n  ✅ No hard type mismatches in bronze→silver layer")

    # ── Phase 2 ──────────────────────────────────────────────────────────────
    print(f"\n{'═' * 70}")
    print("PHASE 2 — Silver → Gold type translations")
    print(f"{'═' * 70}")

    phase2_findings = audit_silver_to_gold()

    p2_by_flag: dict[str, list[dict]] = {}
    for item in phase2_findings:
        p2_by_flag.setdefault(item["flag"], []).append(item)

    p2_flag_order = ["GOLD_MISSING", "IMPLICIT_CAST", "EXPLICIT_CAST", "GOLD_UNCHANGED"]
    p2_icons = {
        "GOLD_MISSING":   "⚠️ ",
        "IMPLICIT_CAST":  "❌",
        "EXPLICIT_CAST":  "✅",
        "GOLD_UNCHANGED": "✅",
    }

    for flag in p2_flag_order:
        items = p2_by_flag.get(flag, [])
        if not items:
            continue
        icon = p2_icons.get(flag, "  ")

        if flag == "GOLD_UNCHANGED":
            # Just print a summary line — no need for all the detail
            print(f"\n{icon} GOLD_UNCHANGED — {len(items)} column(s) pass through with matching types")
            continue

        print(f"\n{icon} {flag} ({len(items)} occurrence{'s' if len(items) != 1 else ''})")
        print(f"  {'─' * 66}")
        for item in items:
            print(f"  [{item['file']}] {item['field']}")
            print(f"    {item['note']}")
        if flag == "IMPLICIT_CAST":
            any_errors = True

    # ── Summary ───────────────────────────────────────────────────────────────
    print(f"\n{'═' * 70}")
    mismatch_count  = len(by_flag.get("MISMATCH", []))
    null_count      = len(by_flag.get("NULL_COLUMN", []))
    sideeffect_count = len(by_flag.get("SIDEEFFECT", []))
    datetime_count  = len(by_flag.get("DATETIME_TEXT", []))
    implicit_count  = len(p2_by_flag.get("IMPLICIT_CAST", []))
    explicit_count  = len(p2_by_flag.get("EXPLICIT_CAST", []))

    print(f"SUMMARY")
    print(f"  Bronze→Silver  ❌ Mismatches:     {mismatch_count}")
    print(f"                 🟡 Null columns:    {null_count}  (source: null; gold must cast)")
    print(f"                 🔵 Side-effects:    {sideeffect_count}  (_currency columns from parse_money)")
    print(f"                 ℹ️  Datetime→TEXT:   {datetime_count}  (advisory; normalize_type limitation)")
    print(f"  Silver→Gold    ❌ Implicit casts:  {implicit_count}  (type differs, no ::cast in SQL)")
    print(f"                 ✅ Explicit casts:  {explicit_count}  (::cast present — healthy)")

    if any_errors:
        print("\nRESULT: ❌ Type issues found — review MISMATCH and IMPLICIT_CAST entries above")
        sys.exit(1)
    else:
        print("\nRESULT: ✅ No hard type errors — see advisory items above for known limitations")
        sys.exit(0)


if __name__ == "__main__":
    main()
