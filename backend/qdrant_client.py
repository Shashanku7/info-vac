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

def ensure_collection(client: QdrantClient, collection_name: str = "sources", vector_size: int = 3072):
    """Ensure the Qdrant collection exists for storing source chunks.

    Upgraded for Hybrid Search: supports unnamed dense vector (default size 3072)
    and a named sparse vector ('sparse-text'). Automatically deletes and recreates
    the collection if schema dimensions change.
    """
    collections = client.get_collections().collections
    exists = False
    
    if any(c.name == collection_name for c in collections):
        try:
            info = client.get_collection(collection_name)
            # check dense vector config size
            dense_cfg = info.config.params.vectors
            existing_size = dense_cfg.size if hasattr(dense_cfg, 'size') else getattr(dense_cfg, 'size', None)
            
            # check if named vectors is used
            if existing_size is None and hasattr(dense_cfg, '__dict__'):
                # it might be a dictionary of named VectorParams
                pass
                
            has_sparse = (
                info.config.params.sparse_vectors is not None 
                and "sparse-text" in info.config.params.sparse_vectors
            )
            
            if existing_size != vector_size or not has_sparse:
                logger.info(
                    "Recreating Qdrant collection due to dimension or config change", 
                    collection=collection_name, 
                    old_size=existing_size, 
                    new_size=vector_size,
                    has_sparse=has_sparse
                )
                client.delete_collection(collection_name)
                exists = False
            else:
                exists = True
        except Exception as e:
            logger.warning("Error inspecting Qdrant collection, forcing recreation", error=str(e))
            try:
                client.delete_collection(collection_name)
            except Exception:
                pass
            exists = False
            
    if not exists:
        logger.info("Creating new Qdrant collection with Hybrid Search config", collection=collection_name, vector_size=vector_size)
        client.create_collection(
            collection_name=collection_name,
            vectors_config=models.VectorParams(
                size=vector_size, 
                distance=models.Distance.COSINE
            ),
            sparse_vectors_config={
                "sparse-text": models.SparseVectorParams(
                    index=models.SparseIndexParams(on_disk=True)
                )
            }
        )
        client.create_payload_index(
            collection_name=collection_name,
            field_name="program_id",
            field_schema=models.PayloadSchemaType.KEYWORD,
        )
    else:
        logger.info("Qdrant collection already exists and matches configuration", collection=collection_name)
