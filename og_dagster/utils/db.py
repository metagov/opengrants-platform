import os

from dagster import get_dagster_logger
from sqlalchemy import create_engine, text

import duckdb

logger = get_dagster_logger()

# utils/db.py


def drop_dependent_views(engine, table_name, context):
    """Drop views that depend on a table before replacing it."""
    # Map table names to their dependent views
    view_mapping = {
        "silver_giveth_grant_pools": "gold__all_grant_pools",
        "silver_giveth_projects": "gold__all_projects",
    }

    dependent_view = view_mapping.get(table_name)
    if dependent_view:
        with engine.connect() as conn:
            try:
                conn.execute(text(f"DROP VIEW IF EXISTS {dependent_view} CASCADE"))
                conn.commit()
                context.log.info(f"Dropped dependent view {dependent_view}")
            except Exception as e:
                context.log.warning(f"Could not drop view {dependent_view}: {e}")


def get_duckdb_connection():
    path = os.getenv("DUCKDB_CACHE_PATH", "./duckdb/data/local.duckdb")
    os.makedirs(os.path.dirname(path), exist_ok=True)
    return duckdb.connect(path)


def get_pg_engine():
    """
    Build and return a SQLAlchemy engine using environment variables.
    This keeps DB connection logic consistent across assets.
    """

    pg_user = os.getenv("POSTGRES_USER", "postgres")
    pg_pass = os.getenv("POSTGRES_PASSWORD", "postgres")
    pg_host = os.getenv("POSTGRES_HOST", "postgres")
    pg_db = os.getenv("POSTGRES_DB", "opengrants")
    pg_port = os.getenv("POSTGRES_PORT", "5432")

    conn_str = f"postgresql+psycopg2://{pg_user}:{pg_pass}@{pg_host}:{pg_port}/{pg_db}"

    logger.info(f"📦 Connecting to PostgreSQL at {pg_host}:{pg_port}/{pg_db}")
    engine = create_engine(conn_str)
    return engine
