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
@dlt.resource(
    write_disposition="merge", 
    primary_key="contract_id"
)
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
            
            # Base record
            record = {
                "contract_id": rec[0].hex(),
                "recipient_address": rec[2],
                "metadata_url": rec[1],
            }

            if rec[1]:
                try:
                    resp = requests.get(rec[1], timeout=10)
                    if resp.ok:
                        metadata = resp.json()
                        
                        # Flatten the metadata to top-level columns
                        if isinstance(metadata, dict):
                            # Extract all the fields you want at the top level
                            record.update({
                                "name": metadata.get("name"),
                                "short_bio": metadata.get("short_bio"),
                                "bio": metadata.get("bio"),
                                "profile_image_url": metadata.get("profile_image_url"),
                                "banner_image_url": metadata.get("banner_image_url"),
                                "website_url": metadata.get("website_url"),
                                "payout_address": metadata.get("payout_address"),
                                "github": metadata.get("github"),
                                "twitter": metadata.get("twitter"),
                                "contribution_description": metadata.get("contribution_description"),
                                "impact_description": metadata.get("impact_description"),
                                "submitted_at": metadata.get("submitted_at"),
                                "creator": metadata.get("creator"),
                                # Keep nested structures as JSON
                                "contribution_links": metadata.get("contribution_links"),
                                "funding_sources": metadata.get("funding_sources"),
                                "impact_category": metadata.get("impact_category")
                            })
                            
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

    # DROP THE EXISTING SCHEMA TO START FRESH
    print("🗑️ Dropping existing schema to start fresh...")
    pipeline.drop()

    load_info = pipeline.run(privote_source())
    
    # Your existing summary code...
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

