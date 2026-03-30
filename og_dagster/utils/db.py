import os
from datetime import datetime, timezone

from dagster import get_dagster_logger
from sqlalchemy import create_engine, text

import duckdb

logger = get_dagster_logger()

# utils/db.py


def drop_table_cascade(engine, table_name, context):
    """Drop a table with CASCADE to remove any dependent views first."""
    with engine.connect() as conn:
        try:
            conn.execute(text(f'DROP TABLE IF EXISTS "{table_name}" CASCADE'))
            conn.commit()
            context.log.info(f"Dropped table {table_name} (CASCADE)")
        except Exception as e:
            context.log.warning(f"Could not drop table {table_name}: {e}")


def get_duckdb_connection():
    path = os.getenv("DUCKDB_CACHE_PATH", "./duckdb/data/local.duckdb")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return duckdb.connect(path)


def upsert_platform_metadata(engine, platform: str, data_source: str = "", notes: str = "") -> None:
    """
    Create or update the platform_metadata row for `platform`, setting
    last_indexed_at to the current UTC time.  Called at the end of each
    bronze ingest asset so the dashboard shows a live 'Data indexed' label.
    """
    now = datetime.now(timezone.utc)
    with engine.connect() as conn:
        conn.execute(text("""
            CREATE TABLE IF NOT EXISTS platform_metadata (
                platform       TEXT PRIMARY KEY,
                last_indexed_at TIMESTAMPTZ NOT NULL,
                data_source    TEXT,
                notes          TEXT
            )
        """))
        conn.execute(text("""
            INSERT INTO platform_metadata (platform, last_indexed_at, data_source, notes)
            VALUES (:platform, :ts, :data_source, :notes)
            ON CONFLICT (platform) DO UPDATE
              SET last_indexed_at = EXCLUDED.last_indexed_at,
                  data_source     = EXCLUDED.data_source,
                  notes           = EXCLUDED.notes
        """), {"platform": platform, "ts": now, "data_source": data_source, "notes": notes})
        conn.commit()
    logger.info(f"platform_metadata updated for '{platform}' at {now.isoformat()}")


def get_pg_engine():
    """
    Build and return a SQLAlchemy engine using environment variables.
    Prefers DATABASE_URL if set (production/Render), otherwise falls back
    to individual POSTGRES_* vars (local Docker Compose).
    """
    database_url = os.getenv("DATABASE_URL")
    if database_url:
        # Ensure psycopg2 driver prefix
        if database_url.startswith("postgresql://"):
            database_url = database_url.replace("postgresql://", "postgresql+psycopg2://", 1)
        logger.info("Connecting to PostgreSQL via DATABASE_URL")
        return create_engine(database_url)

    pg_user = os.getenv("POSTGRES_USER", "postgres")
    pg_pass = os.getenv("POSTGRES_PASSWORD", "postgres")
    pg_host = os.getenv("POSTGRES_HOST", "postgres")
    pg_db = os.getenv("POSTGRES_DB", "opengrants")
    pg_port = os.getenv("POSTGRES_PORT", "5432")

    conn_str = f"postgresql+psycopg2://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}"

    logger.info(f"Connecting to PostgreSQL at {pg_host}:{pg_port}/{pg_db}")
    return create_engine(conn_str)
