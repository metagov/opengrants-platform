#!/usr/bin/env python3
"""
DAOIP-5 Compliance Assessment Script
=====================================
Reads YAML schema maps and produces a structured compliance report.

Methodology: docs/compliance/daoip5_assessment_methodology.md
Sample report: docs/compliance/daoip5_compliance_report_2026-03-31.md

Usage:
    python scripts/daoip5_compliance_check.py
    python scripts/daoip5_compliance_check.py --sources scf gitcoin2
    python scripts/daoip5_compliance_check.py --output docs/compliance/report.md
    python scripts/daoip5_compliance_check.py --format json
    python scripts/daoip5_compliance_check.py --fail-on-p0
    python scripts/daoip5_compliance_check.py --verbose
"""

import argparse
import json
import os
import re
import sys
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import yaml

# ---------------------------------------------------------------------------
# Paths (all relative to project root)
# ---------------------------------------------------------------------------
REPO_ROOT = Path(__file__).resolve().parent.parent
SCHEMA_MAP_DIR = REPO_ROOT / "og_dagster" / "configs" / "schema_maps" / "active"
DAOIP5_SPEC = REPO_ROOT / "raw_data" / "DAOIP-5" / "DAOIP-5.md"

# ---------------------------------------------------------------------------
# DAOIP-5 Required Fields Registry
# Source: raw_data/DAOIP-5/DAOIP-5.md — RFC 2119 MUST language
# ---------------------------------------------------------------------------
REQUIRED_FIELDS: Dict[str, List[str]] = {
    "grant_pools": [
        "id",
        "name",
        "description",
        "grantFundingMechanism",
        "isOpen",
        "totalGrantPoolSizeInUSD",
    ],
    "projects": [
        "id",
        "name",
        "description",
        "contentURI",
    ],
    "grant_applications": [
        "id",
        "grantPoolId",
        "projectId",
        "createdAt",
    ],
}

# High-value optional fields tracked separately for reporting visibility
HIGH_VALUE_OPTIONAL: List[str] = [
    "fundsAskedInUSD",
    "fundsApprovedInUSD",
    "payoutAddress",
    "payouts",
    "status",
    "closeDate",
    "applicationsURI",
    "socials",
    "image",
    "email",
    "membersURI",
]

# Hardcoded values that are semantically harmful (fabrications vs benign defaults)
# A required field returning one of these patterns is flagged P0
FABRICATED_PATTERNS: List[str] = [
    r"'20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ'",  # literal ISO timestamp
    r"\"20\d\d-\d\d-\d\dT\d\d:\d\d:\d\dZ\"",
]

# Numeric zero on a required field that represents a funding amount is also fabricated
FABRICATED_NUMERIC_FIELDS: List[str] = ["totalGrantPoolSizeInUSD", "fundsApprovedInUSD"]

# ---------------------------------------------------------------------------
# Data classes
# ---------------------------------------------------------------------------


class FieldCategory(Enum):
    SOURCE_MAPPED = "source_mapped"  # field derives its value from a named source column; the transform (if any) uses that column's value rather than ignoring it
    COMPUTED = "computed"            # field is synthesized from two or more source columns, or constructed into a new data structure (JSON array/object) from one source column; output is still data-driven
    HARDCODED = "hardcoded"          # field returns a literal constant regardless of what the source data contains; the transform uses lambda _: convention to explicitly ignore its input
    NULL = "null"                    # no source column is mapped and no transform is defined; the silver field will be database NULL


class IssueSeverity(Enum):
    P0 = "P0"  # fabricated required field — corrupts analytics silently
    P1 = "P1"  # data exists in bronze but not wired into silver
    P2 = "P2"  # semantic mismatch — wrong field used
    P3 = "P3"  # structural gap — schema absent or incompatible


@dataclass
class FieldResult:
    name: str
    schema_type: str        # grant_pools | projects | grant_applications
    source: object          # None | str | list[str]
    transform_str: Optional[str]
    category: FieldCategory
    is_required: bool
    is_high_value_optional: bool
    points: int
    max_points: int
    issues: List[str] = field(default_factory=list)


@dataclass
class SchemaResult:
    schema_type: str
    implemented: bool
    fields: List[FieldResult] = field(default_factory=list)

    @property
    def score_pct(self) -> float:
        if not self.implemented or not self.fields:
            return 0.0
        total = sum(f.points for f in self.fields)
        maximum = sum(f.max_points for f in self.fields)
        return (total / maximum * 100) if maximum > 0 else 0.0

    @property
    def source_mapped_pct(self) -> float:
        """Percentage of fields that derive their value from a source column (SOURCE_MAPPED or COMPUTED).
        Fields that are HARDCODED or NULL are excluded. This measures what fraction of the schema
        carries forward information from the underlying source system rather than writing constants."""
        if not self.implemented or not self.fields:
            return 0.0
        column_backed = sum(
            1 for f in self.fields
            if f.category in (FieldCategory.SOURCE_MAPPED, FieldCategory.COMPUTED)
        )
        return column_backed / len(self.fields) * 100

    @property
    def required_failures(self) -> List[FieldResult]:
        return [
            f for f in self.fields
            if f.is_required and f.category in (FieldCategory.HARDCODED, FieldCategory.NULL)
        ]


@dataclass
class SourceResult:
    source_name: str       # e.g. "scf", "gitcoin2", "ens"
    system_label: str      # human-readable from manifest
    schema_version: str
    last_updated: str
    schemas: Dict[str, SchemaResult] = field(default_factory=dict)
    p0_issues: List[str] = field(default_factory=list)
    p1_issues: List[str] = field(default_factory=list)
    p2_issues: List[str] = field(default_factory=list)
    p3_issues: List[str] = field(default_factory=list)

    @property
    def overall_score_pct(self) -> float:
        total_pts = sum(
            sum(f.points for f in s.fields)
            for s in self.schemas.values()
        )
        max_pts = sum(
            sum(f.max_points for f in s.fields)
            for s in self.schemas.values()
        )
        return (total_pts / max_pts * 100) if max_pts > 0 else 0.0

    @property
    def overall_source_mapped_pct(self) -> float:
        """Percentage of all DAOIP-5 fields across all implemented schemas that derive
        their value from a source column. Does not count HARDCODED or NULL fields regardless
        of whether they are required or optional."""
        column_backed = sum(
            sum(
                1 for f in s.fields
                if f.category in (FieldCategory.SOURCE_MAPPED, FieldCategory.COMPUTED)
            )
            for s in self.schemas.values()
        )
        total = sum(len(s.fields) for s in self.schemas.values())
        return (column_backed / total * 100) if total > 0 else 0.0


# ---------------------------------------------------------------------------
# Classification logic
# ---------------------------------------------------------------------------

def classify_field(source: object, transform_str: Optional[str]) -> FieldCategory:
    """
    Classify a schema map field into one of four categories.

    Decision tree:
      source=None + no transform              → NULL
      source=None + transform(lambda _: ...)  → HARDCODED
      source=list + transform(lambda _: ...)  → HARDCODED  (list ignored)
      source=list + transform uses params     → COMPUTED
      source=str  + transform(lambda _: ...)  → HARDCODED  (source ignored)
      source=str  + no transform              → SOURCE_MAPPED
      source=str  + transform uses param      → SOURCE_MAPPED
    """
    uses_literal_lambda = bool(
        transform_str and re.search(r"lambda\s+_\s*[,:]", transform_str)
    )

    if source is None:
        if transform_str is None:
            return FieldCategory.NULL
        if uses_literal_lambda:
            return FieldCategory.HARDCODED
        # transform exists but source is null — treat as NULL
        return FieldCategory.NULL

    if isinstance(source, list):
        if uses_literal_lambda:
            return FieldCategory.HARDCODED
        return FieldCategory.COMPUTED

    # Single string source
    if uses_literal_lambda:
        return FieldCategory.HARDCODED

    return FieldCategory.SOURCE_MAPPED


def get_hardcoded_value(transform_str: Optional[str]) -> Optional[str]:
    """Extract the literal value returned by a hardcoded lambda, if detectable."""
    if not transform_str:
        return None
    # Match: lambda _: <value>
    m = re.search(r"lambda\s+_\s*[,:]\s*(.+)", transform_str.strip())
    if m:
        return m.group(1).strip().rstrip("'\"")
    return None


def is_fabricated_hardcode(
    field_name: str,
    transform_str: Optional[str],
    is_required: bool,
) -> bool:
    """
    Return True if this hardcoded field is a fabrication (not just a benign default).
    Only applies to HARDCODED category fields.
    """
    if not is_required:
        return False
    if not transform_str:
        return False

    # Literal timestamp on any required field
    for pattern in FABRICATED_PATTERNS:
        if re.search(pattern, transform_str):
            return True

    # Numeric zero on a required funding amount field
    if field_name in FABRICATED_NUMERIC_FIELDS:
        if re.search(r"lambda\s+_\s*[,:]\s*0\.0\b", transform_str):
            return True

    return False


def score_field(
    field_name: str,
    category: FieldCategory,
    is_required: bool,
    transform_str: Optional[str],
) -> Tuple[int, int]:
    """
    Returns (earned_points, max_possible_points).

    Scoring model:
      Required field:
        SOURCE_MAPPED  → 3/3  (derives value from a named source column)
        COMPUTED       → 2/3  (data-driven but has additional transformation risk)
        HARDCODED (accurate constant) → 1/3  (e.g., grantFundingMechanism for ENS)
        HARDCODED (fabricated value)  → 0/3  (corrupts downstream analytics — P0)
        NULL           → 0/3
      Optional field:
        SOURCE_MAPPED or COMPUTED → 1/1
        HARDCODED or NULL         → 0/1
    """
    if is_required:
        max_pts = 3
        if category == FieldCategory.SOURCE_MAPPED:
            return 3, max_pts
        elif category == FieldCategory.COMPUTED:
            return 2, max_pts
        elif category == FieldCategory.HARDCODED:
            if is_fabricated_hardcode(field_name, transform_str, is_required):
                return 0, max_pts  # P0 — fabricated
            return 1, max_pts  # Hardcoded but accurate (e.g., grantFundingMechanism for ENS)
        else:  # NULL
            return 0, max_pts
    else:
        max_pts = 1
        if category in (FieldCategory.SOURCE_MAPPED, FieldCategory.COMPUTED):
            return 1, max_pts
        return 0, max_pts


# ---------------------------------------------------------------------------
# P0/P1/P2/P3 issue detection
# ---------------------------------------------------------------------------

KNOWN_P1_PATTERNS = [
    # (source_name, schema_type, field_name, explanation)
    (
        "gitcoin2",
        "grant_applications",
        "payouts",
        "bronze_gitcoin2_payouts table exists (from applications_payouts.csv) "
        "with transaction_hash/amount_in_usd/timestamp but is not joined into silver",
    ),
    (
        "gitcoin2",
        "grant_applications",
        "grantPoolName",
        "round name available via join on round_id → bronze_gitcoin2_rounds.round_metadata",
    ),
]

KNOWN_P2_PATTERNS = [
    (
        "gitcoin2",
        "projects",
        "email",
        "Field mapped to metadata.projectTwitter (Twitter handle) — not an email address",
    ),
    (
        "scf",
        "grant_applications",
        "fundsAskedInUSD",
        "Mapped to same column as fundsApprovedInUSD (Total Awarded USD) — "
        "no separate 'funds asked' field exists in Airtable export",
    ),
    (
        "ens",
        "grant_pools",
        "applicationsURI",
        "Mapped to proposal body markdown text (free text), not a URI",
    ),
    (
        "ens",
        "grant_pools",
        "description",
        "Template string 'ENS Small Grants — {title}' is functionally identical to name field",
    ),
]

KNOWN_P3_PATTERNS = [
    (
        "ens",
        "grant_applications",
        None,
        "Schema not implemented — ENS uses Snapshot ranked-choice voting; "
        "applicants are vote choices, not formal grant applications with "
        "fund requests or status transitions",
    ),
    (
        "scf",
        "grant_applications",
        "status",
        "Only 2 status values used (approved/pending). "
        "DAOIP-5 enum has 6 values: pending, in_review, approved, funded, rejected, completed. "
        "Rejected submissions are not present in Airtable export view.",
    ),
    (
        "gitcoin2",
        "grant_pools",
        "grantFundingMechanism",
        "Only maps to 'Quadratic Funding' or 'Direct Grants'. "
        "DAOIP-5 spec recognizes 31 mechanisms. Other strategy_name values fall through.",
    ),
]


def detect_p2_issues(source_name: str, schema_type: str, field_name: str) -> List[str]:
    return [
        msg for (src, schema, fname, msg) in KNOWN_P2_PATTERNS
        if src == source_name and schema == schema_type and fname == field_name
    ]


def detect_p1_issues(source_name: str, schema_type: str, field_name: str) -> List[str]:
    return [
        msg for (src, schema, fname, msg) in KNOWN_P1_PATTERNS
        if src == source_name and schema == schema_type and fname == field_name
    ]


# ---------------------------------------------------------------------------
# YAML parsing
# ---------------------------------------------------------------------------

def parse_schema_map(yaml_path: Path) -> Optional[SourceResult]:
    """Parse a DAOIP-5 schema map YAML and return a SourceResult."""
    with open(yaml_path) as f:
        data = yaml.safe_load(f)

    if not data:
        return None

    manifest = data.get("manifest", {})
    schemas_raw = data.get("schemas", {})

    # Derive source name from filename: daoip5_scf.yaml → scf
    source_name = yaml_path.stem.replace("daoip5_", "")

    result = SourceResult(
        source_name=source_name,
        system_label=manifest.get("source_system", source_name),
        schema_version=str(manifest.get("version", "unknown")),
        last_updated=manifest.get("last_updated", "unknown"),
    )

    schema_type_keys = ["grant_pools", "projects", "grant_applications"]

    for schema_type in schema_type_keys:
        schema_data = schemas_raw.get(schema_type)

        if schema_data is None:
            # Schema not implemented
            sr = SchemaResult(schema_type=schema_type, implemented=False)
            result.schemas[schema_type] = sr
            # Check for known P3
            for (src, stype, fname, msg) in KNOWN_P3_PATTERNS:
                if src == source_name and stype == schema_type and fname is None:
                    result.p3_issues.append(f"[{schema_type}] {msg}")
            continue

        sr = SchemaResult(schema_type=schema_type, implemented=True)
        required_for_type = REQUIRED_FIELDS.get(schema_type, [])
        fields_raw = schema_data.get("fields", {})

        for field_name, field_def in fields_raw.items():
            if not isinstance(field_def, dict):
                continue

            source = field_def.get("source")
            transform_raw = field_def.get("transform")
            transform_str = str(transform_raw).strip() if transform_raw is not None else None

            category = classify_field(source, transform_str)
            is_required = field_name in required_for_type
            is_hvo = field_name in HIGH_VALUE_OPTIONAL
            points, max_points = score_field(field_name, category, is_required, transform_str)

            field_issues: List[str] = []

            # P0 check: fabricated required field
            if (
                category == FieldCategory.HARDCODED
                and is_required
                and is_fabricated_hardcode(field_name, transform_str, is_required)
            ):
                val = get_hardcoded_value(transform_str) or "unknown literal"
                msg = (
                    f"P0 [{source_name}/{schema_type}/{field_name}] "
                    f"Required field hardcoded to fabricated value: {val!r}"
                )
                field_issues.append(msg)
                result.p0_issues.append(msg)

            # P1 check
            for p1_msg in detect_p1_issues(source_name, schema_type, field_name):
                msg = f"P1 [{source_name}/{schema_type}/{field_name}] {p1_msg}"
                field_issues.append(msg)
                result.p1_issues.append(msg)

            # P2 check
            for p2_msg in detect_p2_issues(source_name, schema_type, field_name):
                msg = f"P2 [{source_name}/{schema_type}/{field_name}] {p2_msg}"
                field_issues.append(msg)
                result.p2_issues.append(msg)

            fr = FieldResult(
                name=field_name,
                schema_type=schema_type,
                source=source,
                transform_str=transform_str,
                category=category,
                is_required=is_required,
                is_high_value_optional=is_hvo,
                points=points,
                max_points=max_points,
                issues=field_issues,
            )
            sr.fields.append(fr)

        # Check for P3 issues at schema level
        for (src, stype, fname, msg) in KNOWN_P3_PATTERNS:
            if src == source_name and stype == schema_type and fname is not None:
                result.p3_issues.append(f"[{schema_type}/{fname}] {msg}")

        result.schemas[schema_type] = sr

    return result


# ---------------------------------------------------------------------------
# Report generation
# ---------------------------------------------------------------------------

CAT_SYMBOL = {
    FieldCategory.SOURCE_MAPPED: "SOURCE_MAPPED",
    FieldCategory.COMPUTED: "COMPUTED",
    FieldCategory.HARDCODED: "HARDCODED",
    FieldCategory.NULL: "NULL",
}

SEV_SYMBOL = {
    IssueSeverity.P0: "P0",
    IssueSeverity.P1: "P1",
    IssueSeverity.P2: "P2",
    IssueSeverity.P3: "P3",
}


def fmt_pct(val: float) -> str:
    return f"{val:.0f}%"


def generate_markdown_report(sources: List[SourceResult], verbose: bool = False) -> str:
    lines: List[str] = []
    now = datetime.utcnow().strftime("%Y-%m-%d")

    lines.append(f"# DAOIP-5 Compliance Report")
    lines.append(f"**Generated:** {now}")
    lines.append(
        f"**Sources assessed:** {', '.join(s.source_name for s in sources)}"
    )
    lines.append(
        "**Methodology:** `docs/compliance/daoip5_assessment_methodology.md`"
    )
    lines.append("")

    # ---- Summary table ----
    lines.append("## Summary")
    lines.append("")
    header = "| Source | Grant Pools | Projects | Grant Applications | Overall | P0 |"
    sep    = "|--------|-------------|----------|--------------------|---------|-----|"
    lines.append(header)
    lines.append(sep)

    for s in sources:
        gp = s.schemas.get("grant_pools")
        pr = s.schemas.get("projects")
        ga = s.schemas.get("grant_applications")

        gp_str = fmt_pct(gp.source_mapped_pct) if gp and gp.implemented else "N/A"
        pr_str = fmt_pct(pr.source_mapped_pct) if pr and pr.implemented else "N/A"
        ga_str = fmt_pct(ga.source_mapped_pct) if ga and ga.implemented else "NOT IMPL"
        p0_count = len(s.p0_issues)
        p0_str = f"**{p0_count}**" if p0_count > 0 else "0"

        lines.append(
            f"| **{s.source_name}** | {gp_str} | {pr_str} | {ga_str} | "
            f"**{fmt_pct(s.overall_source_mapped_pct)}** | {p0_str} |"
        )

    lines.append("")
    lines.append(
        "_Column-backed % = (SOURCE_MAPPED + COMPUTED fields) ÷ total fields. "
        "Measures the fraction of DAOIP-5 fields that carry forward information "
        "from the underlying source system. HARDCODED and NULL fields are excluded._"
    )
    lines.append("")

    # ---- P0 issues ----
    all_p0 = [issue for s in sources for issue in s.p0_issues]
    if all_p0:
        lines.append("## P0 Issues — Fabricated Required Fields")
        lines.append("")
        lines.append(
            "> These fields are required by DAOIP-5 but contain fabricated values. "
            "They corrupt downstream analytics silently."
        )
        lines.append("")
        for issue in all_p0:
            lines.append(f"- {issue}")
        lines.append("")

    # ---- Per-source detail ----
    for s in sources:
        lines.append(f"---")
        lines.append(f"")
        lines.append(f"## {s.source_name.upper()} — {s.system_label}")
        lines.append(f"**Schema version:** {s.schema_version} | **Last updated:** {s.last_updated}")
        lines.append(f"**Schema map:** `og_dagster/configs/schema_maps/active/daoip5_{s.source_name}.yaml`")
        lines.append("")

        schema_order = ["grant_pools", "projects", "grant_applications"]
        for schema_type in schema_order:
            sr = s.schemas.get(schema_type)
            if sr is None:
                continue

            lines.append(f"### {schema_type.replace('_', ' ').title()}")
            if not sr.implemented:
                lines.append("")
                lines.append("**NOT IMPLEMENTED** — no schema defined in YAML.")
                if s.p3_issues:
                    for issue in s.p3_issues:
                        if schema_type in issue:
                            lines.append(f"> {issue}")
                lines.append("")
                continue

            lines.append(
                f"**Column-backed fields:** {fmt_pct(sr.source_mapped_pct)} | "
                f"**Weighted score:** {fmt_pct(sr.score_pct)}"
            )
            lines.append("")

            # Field table — show all if verbose, else only failures + high-value
            show_fields = sr.fields if verbose else [
                f for f in sr.fields
                if f.is_required or f.is_high_value_optional or f.issues
                or f.category in (FieldCategory.HARDCODED, FieldCategory.NULL)
            ]

            if show_fields:
                lines.append("| Field | Required | Category | Points | Notes |")
                lines.append("|-------|----------|----------|--------|-------|")
                for fr in show_fields:
                    req_str = "**YES**" if fr.is_required else "opt"
                    cat_str = CAT_SYMBOL[fr.category]
                    pts_str = f"{fr.points}/{fr.max_points}"
                    notes = "; ".join(fr.issues) if fr.issues else ""

                    # Flag source info concisely
                    if fr.category == FieldCategory.SOURCE_MAPPED and not fr.issues:
                        src_display = str(fr.source) if fr.source else ""
                        notes = f"`{src_display}`" if src_display else ""
                    elif fr.category == FieldCategory.HARDCODED and not fr.issues:
                        val = get_hardcoded_value(fr.transform_str)
                        notes = f"hardcoded: `{val}`" if val else "hardcoded"
                    elif fr.category == FieldCategory.NULL and not fr.issues:
                        notes = "no source"

                    lines.append(
                        f"| `{fr.name}` | {req_str} | {cat_str} | {pts_str} | {notes} |"
                    )
                lines.append("")

            # Required field failures
            req_fails = sr.required_failures
            if req_fails:
                lines.append(f"**Required field failures ({len(req_fails)}):**")
                for fr in req_fails:
                    lines.append(
                        f"- `{fr.name}` — {CAT_SYMBOL[fr.category]}"
                        + (f" (fabricated)" if fr.issues else "")
                    )
                lines.append("")

        # Issues for this source
        all_issues = s.p0_issues + s.p1_issues + s.p2_issues + s.p3_issues
        if all_issues:
            lines.append("### Issues")
            lines.append("")
            for sev, issue_list in [
                ("P0", s.p0_issues),
                ("P1", s.p1_issues),
                ("P2", s.p2_issues),
                ("P3", s.p3_issues),
            ]:
                for issue in issue_list:
                    lines.append(f"- **{sev}** {issue}")
            lines.append("")

    # ---- Consolidated issue register ----
    lines.append("---")
    lines.append("")
    lines.append("## Consolidated Issue Register")
    lines.append("")

    for sev_label, getter in [
        ("P0 — Fabricated Required Fields", lambda s: s.p0_issues),
        ("P1 — Data Available But Not Connected", lambda s: s.p1_issues),
        ("P2 — Semantic Mismatch", lambda s: s.p2_issues),
        ("P3 — Structural Gap", lambda s: s.p3_issues),
    ]:
        issues = [issue for s in sources for issue in getter(s)]
        if issues:
            lines.append(f"### {sev_label}")
            lines.append("")
            for issue in issues:
                lines.append(f"- {issue}")
            lines.append("")

    return "\n".join(lines)


def generate_json_report(sources: List[SourceResult]) -> str:
    output = {
        "generated_at": datetime.utcnow().isoformat() + "Z",
        "sources": [],
    }
    for s in sources:
        source_data = {
            "source_name": s.source_name,
            "system_label": s.system_label,
            "schema_version": s.schema_version,
            "last_updated": s.last_updated,
            "overall_source_mapped_pct": round(s.overall_source_mapped_pct, 1),
            "overall_score_pct": round(s.overall_score_pct, 1),
            "p0_count": len(s.p0_issues),
            "p1_count": len(s.p1_issues),
            "p2_count": len(s.p2_issues),
            "p3_count": len(s.p3_issues),
            "schemas": {},
            "issues": {
                "p0": s.p0_issues,
                "p1": s.p1_issues,
                "p2": s.p2_issues,
                "p3": s.p3_issues,
            },
        }
        for schema_type, sr in s.schemas.items():
            schema_data: dict = {
                "implemented": sr.implemented,
                "source_mapped_pct": round(sr.source_mapped_pct, 1) if sr.implemented else None,
                "score_pct": round(sr.score_pct, 1) if sr.implemented else None,
                "required_failures": [f.name for f in sr.required_failures],
                "fields": [],
            }
            for fr in sr.fields:
                schema_data["fields"].append({
                    "name": fr.name,
                    "category": fr.category.value,
                    "is_required": fr.is_required,
                    "is_high_value_optional": fr.is_high_value_optional,
                    "points": fr.points,
                    "max_points": fr.max_points,
                    "source": fr.source,
                    "issues": fr.issues,
                })
            source_data["schemas"][schema_type] = schema_data
        output["sources"].append(source_data)
    return json.dumps(output, indent=2)


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Assess DAOIP-5 compliance across schema map YAML files.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--sources",
        nargs="+",
        metavar="SOURCE",
        help="Only assess these sources (e.g. scf gitcoin2 ens). Default: all.",
    )
    parser.add_argument(
        "--output",
        metavar="FILE",
        help="Write report to this file (default: stdout).",
    )
    parser.add_argument(
        "--format",
        choices=["markdown", "json"],
        default="markdown",
        help="Output format (default: markdown).",
    )
    parser.add_argument(
        "--verbose",
        action="store_true",
        help="Show all fields in field tables, not just failures and high-value ones.",
    )
    parser.add_argument(
        "--fail-on-p0",
        action="store_true",
        help="Exit with code 1 if any P0 issues are found (for CI integration).",
    )
    parser.add_argument(
        "--schema-dir",
        default=str(SCHEMA_MAP_DIR),
        help=f"Path to schema map directory (default: {SCHEMA_MAP_DIR})",
    )
    args = parser.parse_args()

    schema_dir = Path(args.schema_dir)
    if not schema_dir.exists():
        print(f"ERROR: Schema map directory not found: {schema_dir}", file=sys.stderr)
        return 2

    # Find all schema map files
    yaml_files = sorted(schema_dir.glob("daoip5_*.yaml"))
    if not yaml_files:
        print(f"ERROR: No daoip5_*.yaml files found in {schema_dir}", file=sys.stderr)
        return 2

    # Filter by --sources if specified
    if args.sources:
        requested = set(args.sources)
        yaml_files = [
            f for f in yaml_files
            if f.stem.replace("daoip5_", "") in requested
        ]
        if not yaml_files:
            print(f"ERROR: No schema maps found for sources: {args.sources}", file=sys.stderr)
            return 2

    # Parse all schema maps
    sources: List[SourceResult] = []
    for yaml_path in yaml_files:
        result = parse_schema_map(yaml_path)
        if result:
            sources.append(result)

    if not sources:
        print("ERROR: No valid schema maps parsed.", file=sys.stderr)
        return 2

    # Generate report
    if args.format == "json":
        report = generate_json_report(sources)
    else:
        report = generate_markdown_report(sources, verbose=args.verbose)

    # Output
    if args.output:
        out_path = Path(args.output)
        out_path.parent.mkdir(parents=True, exist_ok=True)
        out_path.write_text(report)
        print(f"Report written to: {out_path}", file=sys.stderr)
    else:
        print(report)

    # Print summary to stderr for visibility when outputting to file
    total_p0 = sum(len(s.p0_issues) for s in sources)
    print("", file=sys.stderr)
    print("=== COMPLIANCE SUMMARY ===", file=sys.stderr)
    for s in sources:
        print(
            f"  {s.source_name:12s} {fmt_pct(s.overall_source_mapped_pct):5s} column-backed"
            f"  |  P0:{len(s.p0_issues)}  P1:{len(s.p1_issues)}"
            f"  P2:{len(s.p2_issues)}  P3:{len(s.p3_issues)}",
            file=sys.stderr,
        )
    print(f"  Total P0 issues: {total_p0}", file=sys.stderr)

    if args.fail_on_p0 and total_p0 > 0:
        print(f"\nFailing: {total_p0} P0 issue(s) found.", file=sys.stderr)
        return 1

    return 0


if __name__ == "__main__":
    sys.exit(main())
