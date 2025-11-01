import dlt
import pandas as pd
from pathlib import Path

# Simple function to read any CSV
def load_stellar_csv(file_path: str):
    df = pd.read_csv(file_path)
    return df.to_dict(orient="records")


@dlt.resource(write_disposition="replace")
def stellar_csv_resource(file_path: str = "/app/data/stellar_grants.csv"):
    """Loads Stellar grants CSV into bronze layer."""
    for record in load_stellar_csv(file_path):
        yield record


pipeline = dlt.pipeline(
    pipeline_name="stellar_csv_pipeline",
    destination="postgres",
    dataset_name="bronze_stellar"
)
def stellar_pipeline(file_path: str = "/app/data/stellar_grants.csv"):
    data = stellar_csv_resource(file_path)
    load_info = stellar_pipeline.run(data)
    print(f"✅ Loaded {load_info.load_id} into bronze_stellar dataset")
