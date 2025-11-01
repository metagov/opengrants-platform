import json
from typing import Any, Dict

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
    logger.info(f"Loaded schema: {schema.get('manifest', {}).get('schema_name', path)}")
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
        logger.warning(
            f"⚠️ JSON schema validation failed for '{field_name}': {e.message}"
        )
    except Exception as e:
        logger.warning(f"⚠️ JSON parsing error for '{field_name}': {e}")


# ============================================================
# 3. Type Normalization & Transformations
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


# ============================================================
# 4. Validation Pipeline
# ============================================================


def validate_row(row: dict, schema_fields: dict):
    """Validate a single row of data against schema definitions."""
    validated = {}

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

        # Handle multi-source fallback
        if isinstance(source, list):
            # collect all present values
            vals = [row.get(s) for s in source if row.get(s) not in (None, "")]
            # default behavior → string concatenation if no transform is given
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
            val = row.get(source)
            if transform:
                try:
                    fn = eval(transform)
                    val = fn(val)
                except Exception as e:
                    logger.warning(f"⚠️ Transformation failed for '{field}': {e}")

        # Normalize
        val = normalize_type(val, dtype)

        # Required & enum & JSON schema checks
        if required and (val is None or str(val).strip() == ""):
            row_id = row.get("id") or row.get("grantId") or row.get("projectId") or "unknown"
            logger.warning(f"⚠️ Missing required field '{field}' for row ID {row_id}")

        if allowed and val not in allowed:
            logger.warning(f"⚠️ Invalid enum value for '{field}': {val}")

        if dtype == "json" and json_schema:
            validate_json_field(val, json_schema, field)

        validated[field] = val

    return validated



def transform_dataframe(df: pl.DataFrame, schema_fields: dict) -> pl.DataFrame:
    silver_records = []
    field_names = list(schema_fields.keys())

    for row in df.to_dicts():
        validated = validate_row(row, schema_fields)
        # ensure all columns exist (even if None)
        for f in field_names:
            validated.setdefault(f, None)
        silver_records.append(validated)

    logger.info(f"✅ Transformed {len(silver_records)} rows into Silver schema.")
    return pl.DataFrame(silver_records, infer_schema_length=len(silver_records))



# ============================================================
# 5. Silver Table Builder
# ============================================================


def build_silver(
    df: pl.DataFrame,
    schema_path: str,
    section: str,
) -> pl.DataFrame:
    """
    Build a validated Silver-layer DataFrame for a given DAOIP-5 schema section.
    Keeps extensions as visible, namespaced columns for analytics.

    Example:
        section = "projects" or "grant_pools"
    """
    schema = load_schema(schema_path)
    if section not in schema["schemas"]:
        raise ValueError(f"Schema section '{section}' not found in {schema_path}")

    schema_section = schema["schemas"][section]
    base_fields = schema_section.get("fields", {})
    extensions = schema_section.get("extensions", {})

    # Merge extensions into field map with preserved DAOIP-5 namespaces
    merged_fields = base_fields.copy()
    for namespace, ext_fields in extensions.items():
        for ext_key, ext_config in ext_fields.items():
            merged_fields[f"{namespace}.{ext_key}"] = ext_config

    # Transform and validate
    df_silver = transform_dataframe(df, merged_fields)

    # Meta validations
    meta = schema.get("meta", {}).get("validation_rules", {})
    id_prefix = meta.get("id_format", "")
    if id_prefix:
        bad_ids = df_silver.filter(~pl.col("id").str.starts_with(id_prefix))
        if bad_ids.height > 0:
            logger.warning(f"⚠️ {bad_ids.height} rows have non-compliant IDs.")

    logger.info(f"✅ Silver DataFrame built for section '{section}' with {df_silver.shape[1]} columns.")
    return df_silver

