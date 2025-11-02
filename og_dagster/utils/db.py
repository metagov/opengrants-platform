import os
import duckdb
from dagster import get_dagster_logger
from sqlalchemy import create_engine

logger = get_dagster_logger()


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
