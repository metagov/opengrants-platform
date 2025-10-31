import yaml
import polars as pl
from pathlib import Path
from datetime import datetime

def load_schema_map(source: str, entity: str) -> dict:
    """Load active DAOIP-5 schema map for the given entity."""
    path = Path(f"og_dagster/configs/schema_maps/active/daoip5_{source}_{entity}.yaml")
    with open(path, "r") as f:
        return yaml.safe_load(f)

def apply_schema_map(df: pl.DataFrame, schema_map: dict) -> pl.DataFrame:
    """Apply column mapping from schema YAML to Polars DataFrame."""
    mapped = {}
    for silver_col, meta in schema_map.get("fields", {}).items():
        src = meta.get("source_field")
        mapped[silver_col] = df[src] if src in df.columns else None

    df_mapped = pl.DataFrame(mapped)
    df_mapped = df_mapped.with_columns([
        pl.lit("giveth").alias("_source"),
        pl.lit(datetime.utcnow()).alias("_loaded_at"),
        pl.lit(schema_map.get("version", "v1")).alias("_version")
    ])
    return df_mapped
