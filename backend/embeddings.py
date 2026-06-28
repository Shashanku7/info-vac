import os
import structlog
import google.generativeai as genai
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = structlog.get_logger(__name__)

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
    """Convert a list of text chunks into vector embeddings using Google's API.

    Uses models/gemini-embedding-2 (dimension 3072) which is completely free, 
    highly accurate, and operates without loading heavy local models.
    """
    if not texts:
        return []
        
    gemini_key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY", "")
    if not gemini_key:
        logger.warning("No Google API Key found for embeddings. Returning dummy vectors.")
        return [[0.0] * 3072 for _ in texts]
        
    try:
        genai.configure(api_key=gemini_key)
        
        # Batch call Google's gemini-embedding-2 API
        result = genai.embed_content(
            model="models/gemini-embedding-2",
            content=texts
        )
        return result["embedding"]
    except Exception as e:
        logger.error("Failed to generate Google embeddings", error=str(e))
        # Fallback to dummy vectors of size 3072 to prevent pipeline crashes
        return [[0.0] * 3072 for _ in texts]
