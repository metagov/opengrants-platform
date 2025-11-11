import os
import requests
import dlt
from web3 import Web3
from dotenv import load_dotenv

# --------------------------------------------------------------------
# Load environment variables
# --------------------------------------------------------------------
load_dotenv()

# Default connection to OpenGrants Postgres
DATABASE_URL = os.getenv(
    "DATABASE_URL",
    "postgresql+psycopg2://postgres:postgres@postgres:5432/opengrants"
)

RPC_ENDPOINT = os.getenv("RPC_ENDPOINT", "https://arb-mainnet.g.alchemy.com/v2/YOUR_KEY")
CONTRACT_ADDRESS = os.getenv("PRIVOTE_CONTRACT", "0xF13833531B5018C1Cb93C01100b6A9BEd1c12De8")

CONTRACT_ABI = [
    {
        "inputs": [],
        "name": "recipientCount",
        "outputs": [{"internalType": "uint256", "name": "", "type": "uint256"}],
        "stateMutability": "view",
        "type": "function"
    },
    {
        "inputs": [{"internalType": "uint256", "name": "index", "type": "uint256"}],
        "name": "getRecipient",
        "outputs": [
            {
                "components": [
                    {"internalType": "bytes32", "name": "id", "type": "bytes32"},
                    {"internalType": "string", "name": "metadataUrl", "type": "string"},
                    {"internalType": "address", "name": "recipient", "type": "address"}
                ],
                "internalType": "struct IRecipientRegistry.Recipient",
                "name": "",
                "type": "tuple"
            }
        ],
        "stateMutability": "view",
        "type": "function"
    }
]

# --------------------------------------------------------------------
# DLT Resource
# --------------------------------------------------------------------
@dlt.resource(write_disposition="merge", primary_key="contract_id")
def privote_contract_recipients():
    """Fetch all recipients and metadata from Privote registry."""
    w3 = Web3(Web3.HTTPProvider(RPC_ENDPOINT))
    if not w3.is_connected():
        raise ConnectionError("❌ Cannot connect to Arbitrum RPC endpoint")

    contract = w3.eth.contract(address=Web3.to_checksum_address(CONTRACT_ADDRESS), abi=CONTRACT_ABI)
    count = contract.functions.recipientCount().call()
    print(f"📡 Found {count} recipients in Privote registry")

    for i in range(count):
        try:
            rec = contract.functions.getRecipient(i).call()
            record = {
                "contract_id": rec[0].hex(),
                "recipient_address": rec[2],
                "metadata_url": rec[1],
                "metadata": None,
            }

            if rec[1]:
                try:
                    resp = requests.get(rec[1], timeout=10)
                    if resp.ok:
                        record["metadata"] = resp.json()
                except Exception as err:
                    print(f"⚠️ Failed to fetch metadata for {rec[1]}: {err}")

            yield record
        except Exception as e:
            print(f"❌ Error fetching recipient {i}: {e}")


@dlt.source
def privote_source():
    """DLT Source definition for Privote."""
    return [privote_contract_recipients]


def run_pipeline():
    """Run Privote DLT pipeline → Postgres opengrants DB."""
    dataset = os.getenv("DLT_DEFAULT_DATASET", "public")
    database_url = os.getenv(
        "DATABASE_URL",
        "postgresql+psycopg2://postgres:postgres@postgres:5432/opengrants"
    )

    # Tell DLT to use Postgres and pass creds via env var
    os.environ["DLT_DESTINATION__POSTGRES__CREDENTIALS"] = database_url
    os.environ["DLT_DEFAULT_DESTINATION"] = "postgres"

    print(f"🚀 Loading Privote data into {database_url}")

    pipeline = dlt.pipeline(
        pipeline_name="privote",
        destination="postgres",
        dataset_name=dataset,
    )

    load_info = pipeline.run(privote_source())
    # Safely access the key, defaulting to 0 if not found
    total_completed = load_info.load_packages[0].jobs.get("completed_jobs_count", 0)

    # You can then check if total_completed is greater than 0 if needed
    print(load_info.load_packages[0].jobs.keys())
    if total_completed > 0:
        print(f"Total completed jobs: {total_completed}")
    else:
        # Handle the case where no jobs completed or the key wasn't present
        if load_info.has_failed_jobs:
            print("Warning: There are failed jobs in the load package.")
            # You can print more details about the failures
            print(load_info.failed_jobs) 
            # Or use the built-in raise method if you want to stop execution
            # load_info.raise_on_failed_jobs()
        print("No completed jobs count available, possibly due to failures or incompleteness.")

    # Print summary of completed jobs (compatible with new DLT versions)
    jobs = load_info.load_packages[0].jobs
    completed = jobs.get("completed_jobs", [])
    failed = jobs.get("failed_jobs", [])

    print(f"📊 DLT Load Summary:")
    print(f"  Completed Jobs: {len(completed)}")
    print(f"  Failed Jobs: {len(failed)}")

    if failed:
        print("⚠️ Some jobs failed to load:")
        for job in failed:
            print(f"   - {job.file_path} ({job.failed_message})")

    print(f"✅ Loaded {len(completed)} Privote records into Postgres → schema: {dataset}")



if __name__ == "__main__":
    run_pipeline()

