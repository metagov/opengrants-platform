# ============================================================
# Silver Layer - Stellar Community Fund (SCF)
# Normalizes bronze tables using DAOIP-5 schema map
# ============================================================

import os
import pandas as pd
import yaml
from dagster import asset, Output, MetadataValue
from sqlalchemy import create_engine

SCHEMA_MAP_PATH = "og_dagster/configs/schema_maps/active/daoip5_scf.yaml"

POSTGRES_URL = (
    f"postgresql://{os.getenv('POSTGRES_USER','postgres')}:"
    f"{os.getenv('POSTGRES_PASSWORD','postgres')}@"
    f"{os.getenv('POSTGRES_HOST','localhost')}:"
    f"{os.getenv('POSTGRES_PORT','5432')}/"
    f"{os.getenv('POSTGRES_DB','opengrants')}"
)

def load_yaml_schema():
    with open(SCHEMA_MAP_PATH, "r") as f:
        return yaml.safe_load(f)

def safe_apply(df, func, default=None):
    try:
        return df.apply(func, axis=1)
    except Exception as e:
        print(f"[WARN] transform failed: {e}")
        return default

@asset(deps=["bronze_scf_projects"], group_name="silver_scf")
def silver_scf_projects() -> Output[pd.DataFrame]:
    schema = load_yaml_schema()["schemas"]["projects"]
    engine = create_engine(POSTGRES_URL)
    df = pd.read_sql("SELECT * FROM bronze_scf_projects", engine)
    mapped = pd.DataFrame()

    # Field mapping
    for target_field, spec in schema["fields"].items():
        col = spec["source"]
        mapped[target_field] = df[col] if col in df.columns else None

    # Flatten extensions
    for ext_field, ext_spec in schema["extensions"]["io.scf"].items():
        col = ext_spec["source"]
        mapped[f"io.scf.{ext_field}"] = df[col] if col in df.columns else None

    mapped.to_sql("silver_scf_projects", engine, if_exists="replace", index=False)
    return Output(mapped, metadata={"num_rows": len(mapped), "columns": list(mapped.columns)})


@asset(deps=["bronze_scf_submissions"], group_name="silver_scf")
def silver_scf_grant_applications() -> Output[pd.DataFrame]:
    schema = load_yaml_schema()["schemas"]["grant_applications"]
    engine = create_engine(POSTGRES_URL)
    df = pd.read_sql("SELECT * FROM bronze_scf_submissions", engine)
    mapped = pd.DataFrame()

    for target_field, spec in schema["fields"].items():
        col = spec["source"]
        mapped[target_field] = df[col] if col in df.columns else None

    for ext_field, ext_spec in schema["extensions"]["io.scf"].items():
        col = ext_spec["source"]
        mapped[f"io.scf.{ext_field}"] = df[col] if col in df.columns else None

    mapped.to_sql("silver_scf_grant_applications", engine, if_exists="replace", index=False)
    return Output(mapped, metadata={"num_rows": len(mapped), "columns": list(mapped.columns)})


@asset(deps=["bronze_scf_rounds"], group_name="silver_scf")
def silver_scf_grant_pools() -> Output[pd.DataFrame]:
    schema = load_yaml_schema()["schemas"]["grant_pools"]
    engine = create_engine(POSTGRES_URL)
    df = pd.read_sql("SELECT * FROM bronze_scf_rounds", engine)
    mapped = pd.DataFrame()

    for target_field, spec in schema["fields"].items():
        col = spec["source"]
        mapped[target_field] = df[col] if col in df.columns else None

    for ext_field, ext_spec in schema["extensions"]["io.scf"].items():
        col = ext_spec["source"]
        mapped[f"io.scf.{ext_field}"] = df[col] if col in df.columns else None

    mapped.to_sql("silver_scf_grant_pools", engine, if_exists="replace", index=False)
    return Output(mapped, metadata={"num_rows": len(mapped), "columns": list(mapped.columns)})
