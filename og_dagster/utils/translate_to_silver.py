import json
import requests
from typing import Any, Dict, List

import polars as pl
import pandas as pd
import yaml
from dagster import get_dagster_logger
from jsonschema import ValidationError, validate

logger = get_dagster_logger()

# ============================================================
# 0. UNIVERSAL SAFE DB LOADER (Fixes your errors)
# ============================================================

def safe_read_query(conn, query: str) -> pl.DataFrame:
    """
    Safely load any SQL query into a Polars DataFrame.
    Attempts:
    1. polars.read_database(..., cast_columns=str)
    2. pandas.read_sql(..., dtype=str) -> polars
    3. manual SQLAlchemy fetch -> polars
    """
    # Attempt 1 — Polars direct read
    # Attempt 1 — Polars direct read
    try:
        df = pl.read_database(query, conn)
        # Safety: force all columns to Utf8 to avoid "could not append value" errors
        df = df.with_columns([pl.col(col).cast(pl.Utf8) for col in df.columns])
        return df
    except Exception as e1:
        logger.warning(f"⚠️ pl.read_database failed: {e1}")


    # Attempt 2 — Pandas fallback
    try:
        df_pd = pd.read_sql(query, conn)
        df_pd = df_pd.astype(str).where(~df_pd.isnull(), None)
        return pl.from_pandas(df_pd)
    except Exception as e2:
        logger.warning(f"⚠️ pandas.read_sql failed: {e2}")

    # Attempt 3 — Raw fetch
    try:
        result = conn.execute(query)
        columns = result.keys()

        rows = []
        for r in result.fetchall():
            rows.append({c: (None if r[i] is None else str(r[i])) for i, c in enumerate(columns)})

        return pl.DataFrame(rows)
    except Exception as e3:
        logger.error(f"🔥 TOTAL FAILURE loading query: {e3}")
        raise


# ============================================================
# 1. YAML Schema Loader
# ============================================================

def load_schema(path: str) -> Dict[str, Any]:
    with open(path, "r") as f:
        schema = yaml.safe_load(f)
    logger.info(f"📜 Loaded schema: {schema.get('manifest', {}).get('schema_name', path)}")
    return schema


# ============================================================
# 2. JSON Validation Utilities
# ============================================================

def validate_json_field(value: Any, json_schema: dict, field_name: str):
    if value is None:
        return
    try:
        parsed = json.loads(value) if isinstance(value, str) else value
        validate(instance=parsed, schema=json_schema)
    except ValidationError as e:
        logger.warning(f"⚠️ JSON schema validation failed for '{field_name}': {e.message}")
    except Exception as e:
        logger.warning(f"⚠️ JSON parsing error for '{field_name}': {e}")


# ============================================================
# 3. Transform Helpers
# ============================================================

def apply_transform(value: Any, transform_str: str):
    if not transform_str:
        return value
    try:
        fn = eval(transform_str)
        return fn(value)
    except Exception as e:
        logger.warning(f"⚠️ Transformation failed for {value}: {e}")
        return value


def normalize_type(value: Any, dtype: str):
    if value is None:
        return None
    try:
        if dtype == "string":
            return str(value)
        elif dtype in ("int", "integer"):
            return int(value)
        elif dtype in ("float", "number"):
            return float(value)
        elif dtype == "boolean":
            return str(value).lower() in ("true", "1", "yes")
        elif dtype == "json":
            if isinstance(value, str):
                json.loads(value)
                return value
            return json.dumps(value)
        elif dtype in ("datetime", "enum"):
            return str(value)
        else:
            return value
    except:
        return None


# ============================================================
# 4. Row Validation & Enrichment
# ============================================================

def validate_row(row: dict, schema_fields: dict):
    validated = {}

    meta_url = row.get("metadataUrl") or row.get("metadata_url")
    if meta_url and isinstance(meta_url, str) and meta_url.startswith("http"):
        metadata = fetch_metadata_from_url(meta_url)
        for k, v in metadata.items():
            row[f"metadata__{k}"] = v
        row["__metadata_fetched__"] = True
    else:
        row["__metadata_fetched__"] = False

    for field, config in schema_fields.items():
        source = config.get("source")
        dtype = config.get("type", "string")
        transform = config.get("transform")
        required = config.get("required", False)
        json_schema = config.get("json_schema")
        allowed = config.get("allowed")

        if source in (None, "null"):
            validated[field] = None
            continue

        if isinstance(source, list):
            vals = [row.get(s) for s in source if row.get(s)]
            val = " ".join(str(v) for v in vals)
            if transform:
                try:
                    fn = eval(transform)
                    val = fn(*[row.get(s) for s in source])
                except Exception as e:
                    logger.warning(f"⚠️ Transform failed: {e}")
        else:
            val = row.get(source)
            if transform:
                try:
                    val = eval(transform)(val)
                except:
                    pass

        val = normalize_type(val, dtype)

        if required and (val is None or str(val).strip() == ""):
            logger.warning(f"⚠️ Missing required field '{field}'")

        if allowed and val not in allowed:
            logger.warning(f"⚠️ Invalid enum for {field}: {val}")

        if dtype == "json" and json_schema:
            validate_json_field(val, json_schema, field)

        validated[field] = val

    return validated


def transform_dataframe(df: pl.DataFrame, schema_fields: dict) -> pl.DataFrame:
    records = []
    for row in df.to_dicts():
        rec = validate_row(row, schema_fields)
        records.append(rec)

    return pl.DataFrame(records, infer_schema_length=len(records))


# ============================================================
# 5. Silver Table Builder
# ============================================================

def build_silver(engine, schema_path: str, section: str) -> pl.DataFrame:
    schema = load_schema(schema_path)
    schema_section = schema["schemas"][section]

    sources = schema_section.get("sources")
    base_table = schema_section.get("table")
    join_keys = schema_section.get("join_keys", ["id"])

    # -----------------------------
    # MULTI-SOURCE MODE
    # -----------------------------
    if sources:
        dfs = []
        for t in sources:
            parts = t.split(".")
            if len(parts) == 1:
                schema_name, table_name = "public", parts[0]
            else:
                schema_name, table_name = parts[-2], parts[-1]

            query = f'SELECT * FROM "{schema_name}"."{table_name}"'
            logger.info(f"🔍 Loading: {query}")

            with engine.connect() as conn:
                df_part = safe_read_query(conn, query)

            prefix = f"{schema_name}_{table_name}"
            df_part.columns = [f"{prefix}__{c}" for c in df_part.columns]
            dfs.append(df_part)

        df = dfs[0]
        for other in dfs[1:]:
            left_key = [c for c in df.columns if c.endswith("__id")][0]
            right_key = [c for c in other.columns if c.endswith("__id")][0]
            df = df.join(other, left_on=left_key, right_on=right_key, how="left")

    # -----------------------------
    # SINGLE BASE TABLE MODE
    # -----------------------------
    else:
        if isinstance(base_table, list):
            table_ref = base_table[0]
        else:
            table_ref = base_table

        parts = table_ref.split(".")
        if len(parts) == 1:
            schema_name, table_name = "public", parts[0]
        else:
            schema_name, table_name = parts[-2], parts[-1]

        query = f'SELECT * FROM "{schema_name}"."{table_name}"'
        logger.info(f"🔍 Loading: {query}")

        with engine.connect() as conn:
            df = safe_read_query(conn, query)

    # -----------------------------
    # FIELD MERGE + TRANSFORM
    # -----------------------------
    base_fields = schema_section.get("fields", {})
    extensions = schema_section.get("extensions", {})
    merged = base_fields.copy()

    for ns, ext_fields in extensions.items():
        for k, v in ext_fields.items():
            merged[f"{ns}.{k}"] = v

    df_silver = transform_dataframe(df, merged)

    return df_silver
