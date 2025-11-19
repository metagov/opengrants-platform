import json
import requests
from typing import Any, Dict, List

import polars as pl
import yaml
from dagster import get_dagster_logger
from jsonschema import ValidationError, validate

logger = get_dagster_logger()

# ============================================================
# 1. YAML Schema Loader
# ============================================================

def load_schema(path: str) -> Dict[str, Any]:
    """Load a DAOIP-5 schema YAML file."""
    with open(path, "r") as f:
        schema = yaml.safe_load(f)
    logger.info(f"📜 Loaded schema: {schema.get('manifest', {}).get('schema_name', path)}")
    return schema


# ============================================================
# 2. JSON Validation Utilities
# ============================================================

def validate_json_field(value: Any, json_schema: dict, field_name: str):
    """Validate JSON field against schema definition."""
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
# 3. Helpers for Transformation & Metadata Fetch
# ============================================================

def apply_transform(value: Any, transform_str: str):
    """Safely apply inline lambda transformation from schema YAML."""
    if transform_str is None or transform_str.strip() == "":
        return value
    try:
        fn = eval(transform_str)
        return fn(value)
    except Exception as e:
        logger.warning(f"⚠️ Transformation failed for value '{value}': {e}")
        return value


def normalize_type(value: Any, dtype: str):
    """Cast and normalize values per schema type definition."""
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
            if isinstance(value, (dict, list)):
                return json.dumps(value)
            elif isinstance(value, str):
                json.loads(value)  # validate parsable
                return value
            else:
                return json.dumps(value)
        elif dtype == "datetime":
            return str(value)
        elif dtype == "enum":
            return str(value)
        else:
            return value
    except Exception:
        return None


def fetch_metadata_from_url(url: str) -> dict:
    """Fetch and parse JSON metadata from a given URL."""
    if not url or not isinstance(url, str) or not url.startswith("http"):
        return {}
    try:
        resp = requests.get(url, timeout=10)
        if resp.status_code == 200:
            return resp.json()
        logger.warning(f"⚠️ Non-200 response fetching metadata from {url}: {resp.status_code}")
        return {}
    except Exception as e:
        logger.warning(f"⚠️ Error fetching metadata from {url}: {e}")
        return {}


# ============================================================
# 4. Row Validation & Enrichment
# ============================================================

def validate_row(row: dict, schema_fields: dict):
    """Validate and enrich a single row of data."""
    validated = {}

    # Auto-expand metadata if present
    meta_url = row.get("metadataUrl") or row.get("metadata_url")
    if meta_url and isinstance(meta_url, str) and meta_url.startswith("http"):
        metadata = fetch_metadata_from_url(meta_url)
        for k, v in metadata.items():
            if f"metadata__{k}" not in row:
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

        # Handle nulls
        if source in (None, "null"):
            validated[field] = None
            continue

        # Multi-source fallback
        if isinstance(source, list):
            vals = [row.get(s) for s in source if row.get(s) not in (None, "")]
            if not transform:
                val = " ".join(str(v) for v in vals if v)
            else:
                try:
                    fn = eval(transform)
                    val = fn(*[row.get(s) for s in source])
                except Exception as e:
                    logger.warning(f"⚠️ Transformation failed for '{field}': {e}")
                    val = " ".join(str(v) for v in vals if v)
        else:
            # Handle literal constants
            if isinstance(source, str) and (
                " " in source or source.startswith("GG") or source.startswith("daoip-5:")
            ):
                val = source
            else:
                val = row.get(source)

            if transform:
                try:
                    fn = eval(transform)
                    val = fn(val)
                except Exception as e:
                    logger.warning(f"⚠️ Transformation failed for '{field}': {e}")

        val = normalize_type(val, dtype)

        # Required field check
        if required and (val is None or str(val).strip() == ""):
            row_id = row.get("id") or row.get("grantId") or row.get("projectId") or "unknown"
            logger.warning(f"⚠️ Missing required field '{field}' for row ID {row_id}")

        # Enum validation
        if allowed and val not in allowed:
            logger.warning(f"⚠️ Invalid enum value for '{field}': {val}")

        # JSON schema validation
        if dtype == "json" and json_schema:
            validate_json_field(val, json_schema, field)

        validated[field] = val

    return validated


def transform_dataframe(df: pl.DataFrame, schema_fields: dict) -> pl.DataFrame:
    """Apply validation and transformation to each row."""
    silver_records = []
    field_names = list(schema_fields.keys())

    for row in df.to_dicts():
        validated = validate_row(row, schema_fields)
        for f in field_names:
            validated.setdefault(f, None)
        silver_records.append(validated)

    logger.info(f"✅ Transformed {len(silver_records)} rows into Silver schema.")
    return pl.DataFrame(silver_records, infer_schema_length=len(silver_records))


# ============================================================
# 5. Silver Table Builder (Multi-Source & Metadata-Aware)
# ============================================================

def build_silver(engine, schema_path: str, section: str) -> pl.DataFrame:
    """
    Build a validated Silver-layer DataFrame for a given DAOIP-5 schema section.
    Supports multiple source tables from different schemas.
    """
    schema = load_schema(schema_path)
    if section not in schema["schemas"]:
        raise ValueError(f"Schema section '{section}' not found in {schema_path}")

    schema_section = schema["schemas"][section]
    base_table = schema_section.get("table")
    sources = schema_section.get("sources")
    join_keys = schema_section.get("join_keys", ["id"])

    # --------------------------------------------
    # Load & Merge Multi-Table Sources
    # --------------------------------------------
    if sources:
        logger.info(f"📚 Multi-table mode enabled for '{section}': {sources}")
        dfs: List[pl.DataFrame] = []

        for t in sources:
            # Parse table reference - could be "table", "schema.table", or even "database.schema.table"
            parts = t.split('.')
            if len(parts) == 1:
                # Just table name - use public schema
                table_schema, table_name = "public", parts[0]
                full_table_ref = f'"{table_schema}"."{table_name}"'
            elif len(parts) == 2:
                # schema.table format
                table_schema, table_name = parts[0], parts[1]
                full_table_ref = f'"{table_schema}"."{table_name}"'
            else:
                # database.schema.table format (or more complex)
                table_schema, table_name = parts[-2], parts[-1]
                full_table_ref = f'"{table_schema}"."{table_name}"'
                logger.info(f"🔍 Using schema '{table_schema}' for table '{table_name}' from reference '{t}'")
                
            # Use proper SQL identifier quoting for schema and table
            with engine.connect() as conn:
                query = f'SELECT * FROM {full_table_ref}'
                logger.info(f"🔍 Executing query: {query}")
                try:
                    df_part = pl.read_database(query, conn)
                    
                    # Create a unique prefix for column names to avoid conflicts
                    # Use both schema and table name for uniqueness
                    prefix = f"{table_schema}_{table_name}"
                    df_part.columns = [f"{prefix}__{c}" for c in df_part.columns]
                    
                    dfs.append(df_part)
                    logger.info(f"✅ Loaded table {full_table_ref} with {df_part.height} rows, {df_part.width} cols")
                    
                except Exception as e:
                    logger.error(f"❌ Failed to load table {full_table_ref}: {e}")
                    raise

        # Join tables sequentially
        if not dfs:
            raise ValueError(f"No tables could be loaded from sources: {sources}")
            
        df = dfs[0]
        logger.info(f"🔗 Starting join process with {len(dfs)} tables")
        
        for i, other in enumerate(dfs[1:], 1):
            logger.info(f"🔗 Joining table {i+1}/{len(dfs)}")
            
            # Find join keys - look for columns ending with the join key patterns
            left_keys = []
            right_keys = []
            
            for join_key in join_keys:
                # Find columns that end with the join key (after the prefix)
                left_candidates = [col for col in df.columns if col.endswith(f"__{join_key}")]
                right_candidates = [col for col in other.columns if col.endswith(f"__{join_key}")]
                
                if left_candidates and right_candidates:
                    left_keys.extend(left_candidates)
                    right_keys.extend(right_candidates)
                    logger.info(f"   Found join key '{join_key}': {left_candidates[0]} -> {right_candidates[0]}")
                    break  # Use the first matching join key
            
            if not left_keys or not right_keys:
                # Fallback: try to find any columns with the join key in the name
                left_keys = [col for col in df.columns if any(k in col for k in join_keys)]
                right_keys = [col for col in other.columns if any(k in col for k in join_keys)]
                
                if not left_keys or not right_keys:
                    logger.warning(f"⚠️ Could not find join keys {join_keys} in tables {i} and {i+1}; performing cross join.")
                    df = df.join(other, how="cross")
                else:
                    logger.info(f"   Using fallback join keys: {left_keys[0]} -> {right_keys[0]}")
                    df = df.join(other, left_on=left_keys[0], right_on=right_keys[0], how="left")
            else:
                # Use the first matching join key pair
                df = df.join(other, left_on=left_keys[0], right_on=right_keys[0], how="left")

        logger.info(f"✅ Joined {len(sources)} sources from different schemas → {df.height} rows, {df.width} cols")
        
    elif base_table:
        # Handle single table with schema support
        if isinstance(base_table, list):
            # Legacy list format - take first table
            table_ref = base_table[0]
        else:
            table_ref = base_table
            
        # Parse table reference
        parts = table_ref.split('.')
        if len(parts) == 1:
            table_schema, table_name = "public", parts[0]
        else:
            table_schema, table_name = parts[-2], parts[-1]
            
        with engine.connect() as conn:
            query = f'SELECT * FROM "{table_schema}"."{table_name}"'
            logger.info(f"🔍 Executing query: {query}")
            df = pl.read_database(query, conn)
        logger.info(f"📄 Loaded single source table '{table_schema}.{table_name}' ({df.height} rows)")
    else:
        raise ValueError(f"Neither 'table' nor 'sources' provided for section '{section}'")

    # --------------------------------------------
    # Merge field definitions + extensions
    # --------------------------------------------
    base_fields = schema_section.get("fields", {})
    extensions = schema_section.get("extensions", {})
    merged_fields = base_fields.copy()
    for namespace, ext_fields in extensions.items():
        for ext_key, ext_config in ext_fields.items():
            merged_fields[f"{namespace}.{ext_key}"] = ext_config

    # --------------------------------------------
    # Apply transformations & validate
    # --------------------------------------------
    df_silver = transform_dataframe(df, merged_fields)

    # --------------------------------------------
    # Meta validation
    # --------------------------------------------
    meta = schema.get("meta", {}).get("validation_rules", {})
    id_prefix = meta.get("id_format", "")
    if id_prefix and "id" in df_silver.columns:
        bad_ids = df_silver.filter(~pl.col("id").cast(str).str.starts_with(id_prefix))
        if bad_ids.height > 0:
            logger.warning(f"⚠️ {bad_ids.height} rows have non-compliant IDs for section '{section}'")

    logger.info(f"✅ Silver DataFrame built for '{section}' ({df_silver.height} rows, {df_silver.width} cols)")
    return df_silver