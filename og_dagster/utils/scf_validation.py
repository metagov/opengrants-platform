"""Data accuracy gate for SCF silver data, run before anything is made live.

The dashboard, the Gateway API and the MCP server read the silver_scf_* tables directly, and
dbt builds gold from them. Silver is replaced wholesale on every run, so a bad Airtable pull
(a partial response, a renamed column, a mass rename of projects) would go straight to users.

`validate_scf_candidates` builds no tables. It takes the candidate silver frames for all three
SCF tables and compares them with each other and with what is live now. Findings are either:

block   The candidate is wrong or much worse than what is live. Nothing is published.
warn    Worth a look, but not a reason to hold the data back (including known source issues).

Most checks block on *regressions* against the live tables rather than on absolute rules, so
known issues already in production (duplicate application IDs, see #4; paid > awarded in the
source) are reported without freezing the pipeline, while anything that makes them worse stops it.

Every run's outcome is stored in `scf_validation_runs` and written as a markdown report.
"""
import json
import math
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import polars as pl
from sqlalchemy import inspect, text

SECTIONS = {
    "projects": "silver_scf_projects",
    "grant_applications": "silver_scf_grant_applications",
    "grant_pools": "silver_scf_grant_pools",
}
ID_PREFIX = {
    "projects": "daoip-5:scf:project:",
    "grant_applications": "daoip-5:scf:application:",
    "grant_pools": "daoip-5:scf:grantPool:",
}
# The funding total each table must not lose.
FUNDING_COLUMN = {
    "projects": "org.stellar.communityfund.totalAwardedUSD",
    "grant_applications": "fundsApprovedInUSD",
    "grant_pools": "org.stellar.communityfund.totalAwardedUSD",
}
MONEY_COLUMNS = [
    "fundsApprovedInUSD",
    "fundsAskedInUSD",
    "totalGrantPoolSizeInUSD",
    "org.stellar.communityfund.totalAwardedUSD",
    "org.stellar.communityfund.totalPaidUSD",
    "org.stellar.communityfund.totalPaidXLM",
]
APPLICATION_STATUSES = {"pending", "in_review", "approved", "rejected", "completed", "funded", "awarded"}

# Thresholds. Airtable rows are rarely deleted and awards never shrink, so small drops are
# already suspicious.
MAX_ROW_DROP_PCT = 5.0
MAX_FUNDING_DROP_PCT = 2.0
MAX_VANISHED_IDS = 5
MAX_VANISHED_PCT = 2.0
MAX_DUP_SHARE_RISE_PCT = 5.0
NULL_JUMP_PCT = 20.0          # block if a column that was at least 95% filled loses this much
# SCF pays in XLM and fixes each payout's USD value on the payment date, so paid can land a little
# above the USD award. Gaps up to 2.5% are exchange-rate noise. Matches nextjs-dashboard/src/lib/scfPaid.ts.
PAID_OVER_AWARDED_TOLERANCE = 1.025
MAX_SOURCE_MISMATCH_PCT = 10.0

RUNS_TABLE = "scf_validation_runs"
REPORT_DIR = Path("/app/data_quality/scf")

# Run tag that publishes despite blocking findings, after someone has reviewed them.
OVERRIDE_TAG = "scf/accept_validation"


@dataclass
class Finding:
    table: str
    check: str
    severity: str  # "block" | "warn"
    message: str
    examples: List[str] = field(default_factory=list)


@dataclass
class ValidationResult:
    findings: List[Finding] = field(default_factory=list)
    stats: Dict[str, dict] = field(default_factory=dict)

    @property
    def blocking(self) -> List[Finding]:
        return [f for f in self.findings if f.severity == "block"]

    @property
    def warnings(self) -> List[Finding]:
        return [f for f in self.findings if f.severity == "warn"]

    @property
    def passed(self) -> bool:
        return not self.blocking

    def add(self, table, check, severity, message, examples=None):
        self.findings.append(Finding(table, check, severity, message, sorted(map(str, examples or []))[:20]))


class ScfValidationError(Exception):
    def __init__(self, result: ValidationResult):
        self.result = result
        lines = [f"[{f.table}] {f.check}: {f.message}" for f in result.blocking]
        super().__init__("SCF data failed validation; live tables were not changed.\n" + "\n".join(lines))


# ---------------------------------------------------------------------------
# Live state
# ---------------------------------------------------------------------------

@dataclass
class LiveTable:
    rows: int
    ids: List[str]
    columns: List[str]
    null_pct: Dict[str, float]
    funding_total: Optional[float]


def load_live(engine, section: str) -> Optional[LiveTable]:
    """Summarize the live table with plain SQL. Returns None if it doesn't exist yet."""
    table = SECTIONS[section]
    if not inspect(engine).has_table(table):
        return None
    columns = [c["name"] for c in inspect(engine).get_columns(table)]
    with engine.connect() as conn:
        rows = conn.execute(text(f'SELECT COUNT(*) FROM "{table}"')).scalar() or 0
        ids = [r[0] for r in conn.execute(text(f'SELECT id FROM "{table}"'))] if "id" in columns else []
        null_pct = {}
        if rows and columns:
            counts = conn.execute(text(
                "SELECT " + ", ".join(f'COUNT("{c}")' for c in columns) + f' FROM "{table}"'
            )).one()
            null_pct = {c: 100.0 * (rows - n) / rows for c, n in zip(columns, counts)}
        funding = None
        fc = FUNDING_COLUMN[section]
        if fc in columns:
            funding = conn.execute(text(f'SELECT SUM(CAST("{fc}" AS FLOAT)) FROM "{table}"')).scalar()
    return LiveTable(rows, ids, columns, null_pct, float(funding) if funding is not None else None)


# ---------------------------------------------------------------------------
# Checks
# ---------------------------------------------------------------------------

def _pct(part, whole):
    return 100.0 * part / whole if whole else 0.0


def _dup_count(ids) -> int:
    ids = [i for i in ids if i]
    return len(ids) - len(set(ids))


def _check_table(res: ValidationResult, section: str, df: pl.DataFrame, live: Optional[LiveTable]):
    t = SECTIONS[section]
    stats = res.stats.setdefault(t, {"candidate_rows": df.height, "live_rows": live.rows if live else None})

    if df.height == 0:
        res.add(t, "not_empty", "block", "Candidate table has no rows.")
        return
    if "id" not in df.columns:
        res.add(t, "id_present", "block", "Candidate table has no `id` column.")
        return

    ids = df["id"].to_list()
    missing = sum(1 for i in ids if not i or not str(i).strip())
    if missing:
        res.add(t, "id_present", "block", f"{missing} rows have no DAOIP-5 ID.")
    bad_prefix = [i for i in ids if i and not str(i).startswith(ID_PREFIX[section])]
    if bad_prefix:
        res.add(t, "id_format", "block",
                f"{len(bad_prefix)} IDs don't start with `{ID_PREFIX[section]}`.", bad_prefix)
    if "name" in df.columns:
        no_name = df.filter(pl.col("name").is_null() | (pl.col("name").cast(pl.Utf8).str.strip_chars() == "")).height
        if no_name:
            res.add(t, "name_present", "block", f"{no_name} rows have no name.")

    dups = _dup_count(ids)
    live_dups = _dup_count(live.ids) if live else 0
    stats["duplicate_ids"] = dups
    if dups:
        examples = [i for i, n in df.group_by("id").len().iter_rows() if n > 1]
        if section != "grant_applications":
            res.add(t, "id_unique", "block", f"{dups} duplicate IDs.", examples)
        elif live and live.rows and _pct(dups, df.height) - _pct(live_dups, live.rows) > MAX_DUP_SHARE_RISE_PCT:
            # New awards for returning projects add shared IDs as a matter of course (#4), so
            # only a jump in the share of shared IDs is a problem.
            res.add(t, "id_unique", "block",
                    f"Shared application IDs rose from {_pct(live_dups, live.rows):.1f}% to "
                    f"{_pct(dups, df.height):.1f}% of rows ({live_dups} → {dups}).", examples)
        else:
            res.add(t, "id_unique", "warn",
                    f"{dups} application IDs are shared by more than one award (known issue, #4); "
                    f"live has {live_dups}.", examples)

    for col in MONEY_COLUMNS:
        if col not in df.columns or not df[col].dtype.is_numeric():
            continue
        vals = df[col].drop_nulls().cast(pl.Float64)
        neg = int((vals < 0).sum())
        nonfinite = sum(1 for v in vals.to_list() if not math.isfinite(v))
        if neg:
            res.add(t, "amounts_valid", "block", f"`{col}` has {neg} negative values.")
        if nonfinite:
            res.add(t, "amounts_valid", "block", f"`{col}` has {nonfinite} non-finite values.")

    fc = FUNDING_COLUMN[section]
    total = float(df[fc].cast(pl.Float64).sum()) if fc in df.columns else None
    stats["funding_total_usd"] = total

    if not live or live.rows == 0:
        res.add(t, "live_comparison", "warn", "No live table to compare against; only absolute checks ran.")
        return

    drop = _pct(live.rows - df.height, live.rows)
    if drop > MAX_ROW_DROP_PCT:
        res.add(t, "row_count", "block",
                f"Row count fell {drop:.1f}% ({live.rows} → {df.height}); limit is {MAX_ROW_DROP_PCT}%.")
    elif df.height < live.rows:
        res.add(t, "row_count", "warn", f"Row count fell from {live.rows} to {df.height}.")

    if total is not None and live.funding_total:
        fdrop = _pct(live.funding_total - total, live.funding_total)
        if fdrop > MAX_FUNDING_DROP_PCT:
            res.add(t, "funding_total", "block",
                    f"`{fc}` total fell {fdrop:.1f}% (${live.funding_total:,.0f} → ${total:,.0f}); "
                    f"limit is {MAX_FUNDING_DROP_PCT}%.")
        elif total < live.funding_total - 0.5:
            res.add(t, "funding_total", "warn",
                    f"`{fc}` total fell from ${live.funding_total:,.0f} to ${total:,.0f}.")

    vanished = sorted(set(live.ids) - set(ids))
    stats["vanished_ids"] = len(vanished)
    stats["new_ids"] = len(set(ids) - set(live.ids))
    if vanished:
        limit = max(MAX_VANISHED_IDS, math.ceil(len(set(live.ids)) * MAX_VANISHED_PCT / 100))
        sev = "block" if len(vanished) > limit else "warn"
        res.add(t, "ids_stable", sev,
                f"{len(vanished)} live IDs would disappear (renames or deletions upstream; external "
                f"links to them break). Limit is {limit}. They stay in archive_scf_published_ids.",
                vanished)

    dropped_cols = sorted(set(live.columns) - set(df.columns))
    if dropped_cols:
        res.add(t, "schema_stable", "block",
                f"{len(dropped_cols)} live columns are missing from the candidate (API and dashboard "
                "queries would break).", dropped_cols)
    added_cols = sorted(set(df.columns) - set(live.columns))
    if added_cols:
        res.add(t, "schema_stable", "warn", f"{len(added_cols)} new columns.", added_cols)

    for col in df.columns:
        if col not in live.null_pct:
            continue
        before, after = live.null_pct[col], _pct(df[col].null_count(), df.height)
        if before <= 5.0 and after - before >= NULL_JUMP_PCT:
            res.add(t, "fields_populated", "block",
                    f"`{col}` went from {100 - before:.0f}% to {100 - after:.0f}% filled "
                    "(likely a renamed or removed Airtable field).")


def _check_cross_table(res: ValidationResult, frames: Dict[str, pl.DataFrame], live_orphans: Dict[str, int]):
    t = SECTIONS["grant_applications"]
    apps = frames["grant_applications"]
    for ref_col, section in (("grantPoolId", "grant_pools"), ("projectId", "projects")):
        if ref_col not in apps.columns or "id" not in frames[section].columns:
            continue
        known = set(frames[section]["id"].to_list())
        orphans = sorted({r for r in apps[ref_col].to_list() if r and r not in known})
        n = apps.filter(pl.col(ref_col).is_in(orphans)).height if orphans else 0
        res.stats[t][f"orphan_{ref_col}"] = n
        if not orphans:
            continue
        before = live_orphans.get(ref_col)
        if before is not None and n > before:
            res.add(t, "references_resolve", "block",
                    f"{n} applications point to a `{ref_col}` that doesn't exist (live has {before}).", orphans)
        else:
            res.add(t, "references_resolve", "warn",
                    f"{n} applications point to a `{ref_col}` that doesn't exist.", orphans)

    paid, awarded = "org.stellar.communityfund.totalPaidUSD", "fundsApprovedInUSD"
    if paid in apps.columns and awarded in apps.columns:
        has_award = pl.col(awarded).fill_null(0) > 0
        over = apps.filter(has_award & (pl.col(paid) > pl.col(awarded) * PAID_OVER_AWARDED_TOLERANCE))
        if over.height:
            excess = float((over[paid] - over[awarded]).sum())
            res.add(t, "paid_within_award", "warn",
                    f"{over.height} applications record more paid than awarded beyond the "
                    f"{(PAID_OVER_AWARDED_TOLERANCE - 1) * 100:.1f}% XLM exchange-rate allowance "
                    f"(${excess:,.0f} over); this comes from the source data.", over["name"].to_list())
        missing = apps.filter(~has_award & (pl.col(paid).fill_null(0) > 0))
        if missing.height:
            res.add(t, "award_recorded", "warn",
                    f"{missing.height} applications have payments but no award amount in the source data "
                    f"(${float(missing[paid].sum()):,.0f} paid).", missing["name"].to_list())

    # The three tables are separate Airtable views of the same awards; their totals should agree.
    totals = {s: res.stats[SECTIONS[s]].get("funding_total_usd") for s in SECTIONS}
    if all(totals.values()):
        base = totals["grant_applications"]
        for s in ("projects", "grant_pools"):
            gap = abs(_pct(totals[s] - base, base))
            if gap > MAX_SOURCE_MISMATCH_PCT:
                res.add(SECTIONS[s], "totals_reconcile", "block",
                        f"Total awarded (${totals[s]:,.0f}) differs from applications (${base:,.0f}) by {gap:.1f}%.")
            elif gap > 1.0:
                res.add(SECTIONS[s], "totals_reconcile", "warn",
                        f"Total awarded (${totals[s]:,.0f}) differs from applications (${base:,.0f}) by {gap:.1f}%.")


def _live_orphans(engine) -> Dict[str, int]:
    """Orphan counts in the live tables, so known gaps don't block but new ones do."""
    insp = inspect(engine)
    if not all(insp.has_table(SECTIONS[s]) for s in SECTIONS):
        return {}
    out = {}
    apps = SECTIONS["grant_applications"]
    with engine.connect() as conn:
        for ref_col, section in (("grantPoolId", "grant_pools"), ("projectId", "projects")):
            out[ref_col] = conn.execute(text(
                f'SELECT COUNT(*) FROM "{apps}" a WHERE a."{ref_col}" IS NOT NULL '
                f'AND a."{ref_col}" NOT IN (SELECT id FROM "{SECTIONS[section]}" WHERE id IS NOT NULL)'
            )).scalar()
    return out


def validate_scf_candidates(engine, frames: Dict[str, pl.DataFrame]) -> ValidationResult:
    """Validate candidate frames keyed by section ('projects', 'grant_applications', 'grant_pools')."""
    res = ValidationResult()
    for section in SECTIONS:
        _check_table(res, section, frames[section], load_live(engine, section))
    _check_cross_table(res, frames, _live_orphans(engine))
    return res


# ---------------------------------------------------------------------------
# Recording
# ---------------------------------------------------------------------------

def record_validation(engine, result: ValidationResult, run_id: str, overridden: bool = False) -> str:
    """Store the outcome in scf_validation_runs. Returns the status written."""
    status = "passed" if result.passed else ("overridden" if overridden else "blocked")
    with engine.begin() as conn:
        conn.execute(text(f"""
            CREATE TABLE IF NOT EXISTS {RUNS_TABLE} (
                checked_at   TEXT NOT NULL,
                run_id       TEXT,
                status       TEXT NOT NULL,
                blocking     INTEGER NOT NULL,
                warnings     INTEGER NOT NULL,
                stats        TEXT NOT NULL,
                findings     TEXT NOT NULL
            )
        """))
        conn.execute(text(f"""INSERT INTO {RUNS_TABLE}
            (checked_at, run_id, status, blocking, warnings, stats, findings)
            VALUES (:at, :run, :status, :b, :w, :stats, :findings)"""), {
            "at": datetime.now(timezone.utc).isoformat(), "run": run_id, "status": status,
            "b": len(result.blocking), "w": len(result.warnings),
            "stats": json.dumps(result.stats, default=str),
            "findings": json.dumps([f.__dict__ for f in result.findings], default=str),
        })
    return status


def render_report(result: ValidationResult, run_id: str, status: str) -> str:
    icon = {"passed": "✅ Passed — published", "blocked": "⛔ Blocked — live data unchanged",
            "overridden": "⚠️ Blocked findings overridden — published"}[status]
    lines = [
        "# SCF Data Accuracy Check", "",
        f"| | |", f"|---|---|",
        f"| **Run at** | {datetime.now(timezone.utc):%Y-%m-%d %H:%M:%S UTC} |",
        f"| **Run ID** | `{run_id or 'n/a'}` |",
        f"| **Result** | {icon} |",
        f"| **Blocking / warnings** | {len(result.blocking)} / {len(result.warnings)} |", "",
        "## Tables", "",
        "| Table | Live rows | Candidate rows | New IDs | Vanished IDs | Funding total (USD) |",
        "|---|---|---|---|---|---|",
    ]
    for t, s in result.stats.items():
        ft = s.get("funding_total_usd")
        lines.append(f"| `{t}` | {s.get('live_rows', '—')} | {s.get('candidate_rows')} | "
                     f"{s.get('new_ids', '—')} | {s.get('vanished_ids', '—')} | "
                     f"{f'{ft:,.0f}' if ft is not None else '—'} |")
    for title, items in (("Blocking", result.blocking), ("Warnings", result.warnings)):
        if not items:
            continue
        lines += ["", f"## {title}", ""]
        for f in items:
            lines.append(f"- **`{f.table}` · {f.check}:** {f.message}")
            if f.examples:
                lines.append(f"  - e.g. {', '.join(f'`{e}`' for e in f.examples[:10])}")
    if result.blocking and status == "blocked":
        lines += ["", "## What to do", "",
                  "1. Check the findings against Airtable. Silver, gold, the dashboard and the API still "
                  "serve the previous data.",
                  "2. If the source is wrong, fix it in Airtable; the next sensor run re-checks.",
                  f"3. If the change is real (e.g. a deliberate clean-up), re-run `etl_scf_full_job` with "
                  f"the run tag `{OVERRIDE_TAG}=true` to publish it."]
    return "\n".join(lines) + "\n"


def write_report(result: ValidationResult, run_id: str, status: str, report_dir: Optional[Path] = None) -> Optional[Path]:
    report_dir = report_dir or REPORT_DIR
    try:
        report_dir.mkdir(parents=True, exist_ok=True)
        path = report_dir / f"{datetime.now(timezone.utc):%Y-%m-%d_%H-%M-%S}_validation.md"
        path.write_text(render_report(result, run_id, status))
        return path
    except OSError:
        return None
