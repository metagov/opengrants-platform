"""
Single source of truth for Postgres connection settings.

Set these once per service:
    POSTGRES_HOST, POSTGRES_PORT, POSTGRES_USER, POSTGRES_PASSWORD, POSTGRES_DB
    POSTGRES_SSLMODE  (optional, e.g. "require" for DigitalOcean)

Every URL the platform needs (DATABASE_URL, DAGSTER_METADATA_DB_URL, dbt's
DESTINATION__POSTGRES__CREDENTIALS__*) is built from them, so rotating the
password means changing POSTGRES_PASSWORD only.

A variable that is already set always wins, so existing deployments that
still set DATABASE_URL etc. keep working unchanged.

Run as a module to print shell exports for the variables that are not set:
    eval "$(python -m utils.db_env)"
Kept free of dagster imports so the container entrypoint can run it cheaply.
"""
import os
import shlex
from urllib.parse import quote

DEFAULTS = {
    "POSTGRES_HOST": "postgres",
    "POSTGRES_PORT": "5432",
    "POSTGRES_USER": "postgres",
    "POSTGRES_PASSWORD": "postgres",
    "POSTGRES_DB": "opengrants",
}


def pg_parts(env=None) -> dict:
    """Connection parts from POSTGRES_* vars, with local Docker defaults."""
    env = os.environ if env is None else env
    parts = {k: env.get(k) or v for k, v in DEFAULTS.items()}
    parts["POSTGRES_SSLMODE"] = env.get("POSTGRES_SSLMODE", "")
    return parts


def build_url(env=None, driver: str = "postgresql+psycopg2") -> str:
    """Build a connection URL from POSTGRES_* parts. User and password are URL-encoded."""
    p = pg_parts(env)
    url = (
        f"{driver}://{quote(p['POSTGRES_USER'], safe='')}:{quote(p['POSTGRES_PASSWORD'], safe='')}"
        f"@{p['POSTGRES_HOST']}:{p['POSTGRES_PORT']}/{p['POSTGRES_DB']}"
    )
    if p["POSTGRES_SSLMODE"]:
        url += f"?sslmode={p['POSTGRES_SSLMODE']}"
    return url


def database_url(env=None, driver: str = "postgresql+psycopg2") -> str:
    """DATABASE_URL if set (driver prefix normalised), otherwise built from POSTGRES_* parts."""
    env = os.environ if env is None else env
    url = env.get("DATABASE_URL")
    if not url:
        return build_url(env, driver)
    for prefix in ("postgresql+psycopg2://", "postgresql://", "postgres://"):
        if url.startswith(prefix):
            return f"{driver}://" + url[len(prefix):]
    return url


def derived_env(env=None) -> dict:
    """Variables to export: only those not already set in `env`."""
    env = os.environ if env is None else env
    p = pg_parts(env)
    url = build_url(env)
    wanted = {
        "DATABASE_URL": url,
        "DAGSTER_METADATA_DB_URL": url,
        "DESTINATION__POSTGRES__CREDENTIALS__HOST": p["POSTGRES_HOST"],
        "DESTINATION__POSTGRES__CREDENTIALS__PORT": p["POSTGRES_PORT"],
        "DESTINATION__POSTGRES__CREDENTIALS__DATABASE": p["POSTGRES_DB"],
        "DESTINATION__POSTGRES__CREDENTIALS__USERNAME": p["POSTGRES_USER"],
        "DESTINATION__POSTGRES__CREDENTIALS__PASSWORD": p["POSTGRES_PASSWORD"],
    }
    if p["POSTGRES_SSLMODE"]:
        wanted["DESTINATION__POSTGRES__CREDENTIALS__SSLMODE"] = p["POSTGRES_SSLMODE"]
    return {k: v for k, v in wanted.items() if not env.get(k)}


if __name__ == "__main__":
    for key, value in derived_env().items():
        print(f"export {key}={shlex.quote(value)}")
