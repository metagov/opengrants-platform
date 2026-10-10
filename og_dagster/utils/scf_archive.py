"""Append-only archive for SCF data, so pipeline overwrites never lose history.

The SCF pipeline replaces bronze, silver and gold on every run. Two archive tables keep
what those overwrites would otherwise destroy:

archive_scf_bronze_snapshots
    One row per bronze table per change: the full Airtable payload as JSON (including each
    record's `_airtable_id`, which bronze itself drops). A snapshot is skipped when its
    content is identical to the table's previous snapshot, so storage only grows on change.
    Restore with scripts/scf_archive_restore.py.

archive_scf_published_ids
    Every DAOIP-5 ID silver has ever published, with the name it was published under and
    when it was first and last seen. IDs that vanish (renames, merges) keep their row, so
    the history needed to re-key on the earliest published ID is never lost (see #4).

Both tables are plain SQL (no Postgres-only types) and are created on first use.
"""
import hashlib
import json
from datetime import datetime, timezone
from typing import Iterable, Optional, Tuple

from sqlalchemy import text

SNAPSHOTS = "archive_scf_bronze_snapshots"
PUBLISHED_IDS = "archive_scf_published_ids"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def ensure_archive_tables(conn) -> None:
    conn.execute(text(f"""
        CREATE TABLE IF NOT EXISTS {SNAPSHOTS} (
            snapshot_at     TEXT NOT NULL,
            run_id          TEXT,
            table_name      TEXT NOT NULL,
            record_count    INTEGER NOT NULL,
            content_sha256  TEXT NOT NULL,
            payload         TEXT NOT NULL
        )
    """))
    conn.execute(text(f"""
        CREATE TABLE IF NOT EXISTS {PUBLISHED_IDS} (
            entity          TEXT NOT NULL,
            daoip5_id       TEXT NOT NULL,
            name            TEXT,
            first_seen_at   TEXT NOT NULL,
            last_seen_at    TEXT NOT NULL,
            PRIMARY KEY (entity, daoip5_id)
        )
    """))


def canonical_payload(records: list) -> Tuple[str, str]:
    """Deterministic JSON (records sorted by Airtable ID, keys sorted) and its SHA-256."""
    ordered = sorted(records, key=lambda r: (str(r.get("_airtable_id", "")), json.dumps(r, sort_keys=True, default=str)))
    payload = json.dumps(ordered, sort_keys=True, default=str, ensure_ascii=False)
    return payload, hashlib.sha256(payload.encode("utf-8")).hexdigest()


def archive_bronze_snapshot(engine, table_name: str, records: list, run_id: Optional[str] = None) -> bool:
    """Archive one bronze table's records. Returns True if a new snapshot was written,
    False if the content matched the latest snapshot. Raises on failure, so the caller
    can refuse to overwrite bronze without a backup."""
    payload, digest = canonical_payload(records)
    with engine.begin() as conn:
        ensure_archive_tables(conn)
        latest = conn.execute(
            text(f"SELECT content_sha256 FROM {SNAPSHOTS} WHERE table_name = :t ORDER BY snapshot_at DESC LIMIT 1"),
            {"t": table_name},
        ).scalar()
        if latest == digest:
            return False
        conn.execute(
            text(f"""INSERT INTO {SNAPSHOTS} (snapshot_at, run_id, table_name, record_count, content_sha256, payload)
                     VALUES (:at, :run, :t, :n, :h, :p)"""),
            {"at": _now(), "run": run_id, "t": table_name, "n": len(records), "h": digest, "p": payload},
        )
    return True


def record_published_ids(engine, entity: str, rows: Iterable[Tuple[str, Optional[str]]]) -> int:
    """Upsert (daoip5_id, name) pairs published by silver. New IDs get first_seen_at;
    every ID present this run gets last_seen_at bumped. Returns the number of new IDs."""
    now = _now()
    rows = [(i, n) for i, n in rows if i]
    with engine.begin() as conn:
        ensure_archive_tables(conn)
        before = conn.execute(text(f"SELECT COUNT(*) FROM {PUBLISHED_IDS} WHERE entity = :e"), {"e": entity}).scalar()
        for daoip5_id, name in rows:
            conn.execute(
                text(f"""INSERT INTO {PUBLISHED_IDS} (entity, daoip5_id, name, first_seen_at, last_seen_at)
                         VALUES (:e, :i, :n, :now, :now)
                         ON CONFLICT (entity, daoip5_id) DO UPDATE SET last_seen_at = :now"""),
                {"e": entity, "i": daoip5_id, "n": name, "now": now},
            )
        after = conn.execute(text(f"SELECT COUNT(*) FROM {PUBLISHED_IDS} WHERE entity = :e"), {"e": entity}).scalar()
    return after - before
