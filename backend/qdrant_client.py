import os
import structlog
from qdrant_client import QdrantClient
from qdrant_client.http import models

logger = structlog.get_logger(__name__)

def get_qdrant_client() -> QdrantClient:
    url = os.getenv("QDRANT_URL")
    api_key = os.getenv("QDRANT_API_KEY")
    
    if not url or not api_key:
        raise ValueError("QDRANT_URL and QDRANT_API_KEY must be set in .env")
        
    return QdrantClient(url=url, api_key=api_key)

def ensure_collection(client: QdrantClient, collection_name: str = "sources", vector_size: int = 4096):
    """Ensure the Qdrant collection exists for storing source chunks."""
    collections = client.get_collections().collections
    if not any(c.name == collection_name for c in collections):
        logger.info("Creating new Qdrant collection", collection=collection_name, vector_size=vector_size)
        client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=vector_size, 
                distance=models.Distance.COSINE
            )
        )
        client.create_payload_index(
            collection_name=collection_name,
            field_name="program_id",
            field_schema=models.PayloadSchemaType.KEYWORD,
        )
    else:
        logger.info("Qdrant collection already exists", collection=collection_name)
