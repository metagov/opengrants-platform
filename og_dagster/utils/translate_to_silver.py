import json
import re
from typing import Any, Dict, Optional, Tuple

import pandas as pd
import polars as pl
import requests
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
    1. polars.read_database(url_string) — uses ConnectorX bulk transfer (fast)
    2. pandas.read_sql(..., dtype=str) -> polars
    3. manual SQLAlchemy fetch -> polars
    """
    # Attempt 1 — Polars via ConnectorX (fast bulk path)
    # Pass the engine URL string so Polars uses ConnectorX instead of the slow
    # DBAPI cursor path (which it falls back to for SQLAlchemy connection objects).
    try:
        conn_str = None
        if hasattr(conn, 'engine'):
            # SQLAlchemy Connection — extract engine URL
            conn_str = str(conn.engine.url)
        elif hasattr(conn, 'url'):
            # SQLAlchemy Engine
            conn_str = str(conn.url)

        if conn_str:
            df = pl.read_database(query, conn_str)
        else:
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
            rows.append(
                {
                    c: (None if r[i] is None else str(r[i]))
                    for i, c in enumerate(columns)
                }
            )

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
    logger.info(
        f"📜 Loaded schema: {schema.get('manifest', {}).get('schema_name', path)}"
    )
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
        logger.warning(
            f"⚠️ JSON schema validation failed for '{field_name}': {e.message}"
        )
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
    if value is None or value == "":
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
    except Exception as e:
        logger.warning(f"⚠️ Type normalization failed for {value} to {dtype}: {e}")
        return None


# ============================================================
# 4. Enhanced Money Parser (Backward Compatible)
# ============================================================


def parse_money_amount_and_token(raw: str) -> Tuple[Optional[float], Optional[str]]:
    """
    Parse money amount and currency token from string.
    Enhanced version that handles text-to-numeric conversion while maintaining backward compatibility.

    Returns:
        Tuple[amount, token] where amount is float or None, token is str or None
    """
    if not raw or not isinstance(raw, str):
        return None, None

    cleaned = raw.strip()
    if not cleaned:
        return None, None

    # BACKWARD COMPATIBILITY: Original simple parsing first
    try:
        # Original logic - direct conversion
        amount = float(cleaned)
        return amount, 'USD'  # Default token as in original
    except (ValueError, TypeError):
        pass  # Continue to enhanced parsing

    # ENHANCED PARSING: Handle text formats
    try:
        # Common non-numeric indicators
        if cleaned.lower() in [
            '',
            'n/a',
            'none',
            'null',
            'nan',
            'not applicable',
            'pending',
            'tbd',
        ]:
            return None, None

        # Text-to-value mapping for common descriptions
        text_to_value_map = {
            'full funding': 1000000.0,
            'partial funding': 500000.0,
            'small grant': 25000.0,
            'large award': 500000.0,
            'major grant': 1000000.0,
            'mini-grant': 10000.0,
            'seed funding': 50000.0,
        }

        # Check for text mappings (case insensitive)
        cleaned_lower = cleaned.lower()
        for text_pattern, value in text_to_value_map.items():
            if text_pattern in cleaned_lower:
                return value, 'USD'

        # Extract numbers from text using regex patterns
        money_patterns = [
            # Pattern: $50,000 USD or £25,000 GBP
            r'[\$£€¥]?\s*([0-9,]+(?:\.\d+)?)\s*[^\d]*([A-Z]{3})?',
            # Pattern: 50000 dollars or 25000 EUR
            r'([0-9,]+(?:\.\d+)?)\s*(?:dollars|usd|eur|gbp|jpy|euros|pounds)',
            # Pattern: Amount: 50,000 or Award: 25,000.00
            r'(?:amount|award|funding|grant)[^\d]*([0-9,]+(?:\.\d+)?)',
            # Pattern: Total: $1,500,000
            r'(?:total|sum)[^\d]*[\$£€¥]?\s*([0-9,]+(?:\.\d+)?)',
            # Pattern: USD 50000 or EUR 25000
            r'([A-Z]{3})\s*([0-9,]+(?:\.\d+)?)',
        ]

        amount = None
        token = None

        for pattern in money_patterns:
            match = re.search(pattern, cleaned, re.IGNORECASE)
            if match:
                groups = match.groups()

                # Find the amount group
                amount_str = None
                for group in groups:
                    if group and any(c.isdigit() for c in group):
                        # Clean the amount string
                        amount_str = group.replace(',', '').strip()
                        break

                if amount_str:
                    try:
                        amount = float(amount_str)

                        # Extract or infer token
                        if len(groups) > 1:
                            for group in groups:
                                if group and group.upper() in [
                                    'USD',
                                    'EUR',
                                    'GBP',
                                    'JPY',
                                ]:
                                    token = group.upper()
                                    break

                        if not token:
                            # Infer token from context
                            if (
                                '$' in cleaned
                                or 'usd' in cleaned.lower()
                                or 'dollar' in cleaned.lower()
                            ):
                                token = 'USD'
                            elif (
                                '£' in cleaned
                                or 'gbp' in cleaned.upper()
                                or 'pound' in cleaned.lower()
                            ):
                                token = 'GBP'
                            elif (
                                '€' in cleaned
                                or 'eur' in cleaned.upper()
                                or 'euro' in cleaned.lower()
                            ):
                                token = 'EUR'
                            elif (
                                '¥' in cleaned
                                or 'jpy' in cleaned.upper()
                                or 'yen' in cleaned.lower()
                            ):
                                token = 'JPY'
                            else:
                                token = 'USD'  # Default as in original

                        break  # Found a match, stop searching
                    except ValueError:
                        continue

        # Final fallback: extract any numbers from the string
        if amount is None:
            numbers = re.findall(r'[0-9,]+(?:\.\d+)?', cleaned)
            if numbers:
                try:
                    amount = float(numbers[0].replace(',', ''))
                    token = 'USD'  # Default
                except ValueError:
                    pass

        return amount, token

    except Exception as e:
        # Use print for critical errors to avoid Dagster logging issues during failures
        print(f"⚠️ parse_money failed for '{raw}': {e}")
        return None, None


# ============================================================
# 5. Metadata Fetcher (MISSING FUNCTION - ADDED)
# ============================================================


def fetch_metadata_from_url(meta_url: str) -> Dict[str, Any]:
    """
    Fetch metadata from URL.
    Safe implementation with error handling.
    """
    try:
        logger.info(f"🔗 Fetching metadata from: {meta_url}")
        response = requests.get(meta_url, timeout=30)
        response.raise_for_status()

        # Try to parse as JSON
        metadata = response.json()
        logger.info(f"✅ Successfully fetched metadata from {meta_url}")
        return metadata

    except requests.exceptions.RequestException as e:
        logger.warning(f"⚠️ HTTP request failed for {meta_url}: {e}")
        return {}
    except json.JSONDecodeError as e:
        logger.warning(f"⚠️ JSON parsing failed for {meta_url}: {e}")
        return {}
    except Exception as e:
        logger.warning(f"⚠️ Unexpected error fetching metadata from {meta_url}: {e}")
        return {}


# ============================================================
# 6. Row Validation & Enrichment (Enhanced with Safe Money Parsing)
# ============================================================


def validate_row(row: dict, schema_fields: dict):
    validated = {}

    # Safe metadata fetching
    try:
        meta_url = row.get("metadataUrl") or row.get("metadata_url")
        if meta_url and isinstance(meta_url, str) and meta_url.startswith("http"):
            metadata = fetch_metadata_from_url(meta_url)
            for k, v in metadata.items():
                row[f"metadata__{k}"] = v
            row["__metadata_fetched__"] = True
        else:
            row["__metadata_fetched__"] = False
    except Exception as e:
        logger.warning(f"⚠️ Metadata fetch failed: {e}")
        row["__metadata_fetched__"] = False

    for field, config in schema_fields.items():
        try:
            source = config.get("source")
            dtype = config.get("type", "string")
            transform = config.get("transform")
            required = config.get("required", False)
            json_schema = config.get("json_schema")
            allowed = config.get("allowed")

            if source in (None, "null"):
                # Run the transform even when there is no source column — the
                # transform is the value (e.g. "lambda _: False" for constants).
                # Without this, declared types are silently lost: Polars writes
                # an all-null column as TEXT regardless of the declared type.
                if transform:
                    try:
                        val = eval(transform)(None)
                        validated[field] = normalize_type(val, dtype)
                    except Exception as e:
                        logger.warning(f"⚠️ Transform failed for null-source field '{field}': {e}")
                        validated[field] = None
                else:
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
                    except Exception as e:
                        logger.warning(f"⚠️ Transform failed for {field}: {e}")

            # Special handling for float fields: parse money strings (e.g. "$1,500 USD").
            # _currency side-channel is opt-in via store_currency: true in the schema field.
            if dtype in ("float", "number"):
                if val and isinstance(val, str):
                    amount, token = parse_money_amount_and_token(val)
                    if amount is not None:
                        val = amount
                        if config.get("store_currency"):
                            validated[f"{field}_currency"] = token
                    else:
                        val = normalize_type(val, dtype)
                else:
                    val = normalize_type(val, dtype)
            else:
                # Original behavior for non-numeric fields
                val = normalize_type(val, dtype)

            if required and (val is None or str(val).strip() == ""):
                logger.warning(f"⚠️ Missing required field '{field}'")

            if allowed and val not in allowed:
                logger.warning(f"⚠️ Invalid enum for {field}: {val}")

            if dtype == "json" and json_schema:
                validate_json_field(val, json_schema, field)

            validated[field] = val

        except Exception as field_error:
            logger.warning(f"⚠️ Field processing failed for '{field}': {field_error}")
            validated[field] = None

    return validated


def transform_dataframe(df: pl.DataFrame, schema_fields: dict) -> pl.DataFrame:
    records = []
    for row in df.to_dicts():
        rec = validate_row(row, schema_fields)
        records.append(rec)

    return pl.DataFrame(records, infer_schema_length=len(records))


# ============================================================
# 7. Silver Table Builder (Unchanged - maintains compatibility)
# ============================================================


def build_silver(engine, schema_path: str, section: str) -> pl.DataFrame:
    schema = load_schema(schema_path)
    schema_section = schema["schemas"][section]

    sources = schema_section.get("sources")
    base_table = schema_section.get("table")
    # join_keys = schema_section.get("join_keys", ["id"])

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

    # Warn on any columns with null values
    total = len(df_silver)
    if total > 0:
        for col in df_silver.columns:
            null_count = df_silver[col].null_count()
            if null_count > 0:
                pct = round(100 * null_count / total, 1)
                logger.warning(
                    f"⚠️ NULL values in '{col}': {null_count}/{total} rows ({pct}%)"
                )

    return df_silver
