import os
import structlog

from sentence_transformers import SentenceTransformer
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = structlog.get_logger(__name__)

# Use the locally cached quantized Qwen model
MODEL_NAME = "AMAImedia/Qwen3-Embedding-8B-NOESIS-AWQ-INT4"
_model = None

def get_embedding_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info("Loading local Qwen embedding model from Hugging Face cache...", model=MODEL_NAME)
        # trust_remote_code is often required for custom model architectures like Qwen
        _model = SentenceTransformer(MODEL_NAME, trust_remote_code=True)
    return _model

def chunk_text(text: str, chunk_size: int = 600, chunk_overlap: int = 100) -> list[str]:
    """Split raw text into semantic chunks for vector search."""
    if not text:
        return []
        
    splitter = RecursiveCharacterTextSplitter(
        chunk_size=chunk_size,
        chunk_overlap=chunk_overlap,
        separators=["\n\n", "\n", ".", " ", ""]
    )
    return splitter.split_text(text)

def embed_texts(texts: list[str]) -> list[list[float]]:
    """Convert a list of text chunks into vector embeddings."""
    if not texts:
        return []
    
    model = get_embedding_model()
    # SentenceTransformer returns a numpy array, we convert to standard Python lists for Qdrant
    embeddings = model.encode(texts, show_progress_bar=False)
    return embeddings.tolist()
