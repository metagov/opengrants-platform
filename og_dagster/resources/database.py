from dagster import resource
from utils.db import get_pg_engine


@resource
def database_engine_resource(_):
    """
    Dagster resource wrapper around get_pg_engine().
    Ensures a reusable SQLAlchemy engine for all assets.
    """
    return get_pg_engine()
