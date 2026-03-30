# og_dagster/utils/data_quality.py
"""
Data quality reporting for silver ETL assets.

Writes timestamped markdown reports to /app/data_quality/{system}/
on every pipeline run. The /app directory is volume-mounted to the
repo root's og_dagster/ directory, so reports persist across restarts.
"""

import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import polars as pl
from dagster import get_dagster_logger

logger = get_dagster_logger()

REPORT_BASE_DIR = Path("/app/data_quality")


def collect_null_issues(df: pl.DataFrame) -> list[dict[str, Any]]:
    """Scan a DataFrame and return a list of null-value issues."""
    issues = []
    total = len(df)
    if total == 0:
        return issues
    for col in df.columns:
        null_count = df[col].null_count()
        if null_count > 0:
            pct = round(100 * null_count / total, 1)
            issues.append({
                "type": "null_values",
                "field": col,
                "null_count": null_count,
                "total_rows": total,
                "null_pct": pct,
            })
    return issues


def write_data_quality_report(
    system: str,
    table_name: str,
    total_rows: int,
    null_issues: list[dict[str, Any]],
    missing_required: list[str],
    run_id: str = "",
) -> None:
    """
    Write a timestamped markdown data quality report.

    Reports land at:
      og_dagster/data_quality/{system}/{YYYY-MM-DD_HH-MM-SS}_{table_name}.md
    """
    now = datetime.now(timezone.utc)
    timestamp_file = now.strftime("%Y-%m-%d_%H-%M-%S")
    timestamp_display = now.strftime("%Y-%m-%d %H:%M:%S UTC")

    report_dir = REPORT_BASE_DIR / system
    report_dir.mkdir(parents=True, exist_ok=True)

    report_path = report_dir / f"{timestamp_file}_{table_name}.md"

    has_issues = null_issues or missing_required
    status = "⚠️ Issues Found" if has_issues else "✅ Clean"

    lines = [
        f"# Data Quality Report — `{table_name}`",
        f"",
        f"| | |",
        f"|---|---|",
        f"| **System** | {system} |",
        f"| **Table** | `{table_name}` |",
        f"| **Run at** | {timestamp_display} |",
        f"| **Run ID** | `{run_id or 'n/a'}` |",
        f"| **Total rows** | {total_rows:,} |",
        f"| **Status** | {status} |",
        f"",
    ]

    if missing_required:
        lines += [
            f"## Missing Required Fields",
            f"",
            f"These fields are declared `required: true` in the schema but had no value in some rows:",
            f"",
        ]
        for field in sorted(set(missing_required)):
            lines.append(f"- `{field}`")
        lines.append("")

    if null_issues:
        lines += [
            f"## Null Value Summary",
            f"",
            f"| Field | Null Rows | Total Rows | Null % |",
            f"|---|---|---|---|",
        ]
        for issue in sorted(null_issues, key=lambda x: -x["null_pct"]):
            lines.append(
                f"| `{issue['field']}` | {issue['null_count']:,} | "
                f"{issue['total_rows']:,} | {issue['null_pct']}% |"
            )
        lines.append("")

    if not has_issues:
        lines += [
            "## No Issues",
            "",
            f"All {total_rows:,} rows passed data quality checks.",
            "",
        ]

    report_path.write_text("\n".join(lines))
    logger.info(f"📋 Data quality report: {report_path}")
