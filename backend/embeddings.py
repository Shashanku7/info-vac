import os
import structlog
import google.generativeai as genai
from langchain_text_splitters import RecursiveCharacterTextSplitter

logger = structlog.get_logger(__name__)

def _get_gemini_keys() -> list[str]:
    """Returns a list of all configured Gemini keys, checking GEMINI_API_KEYS and single fallback keys."""
    keys_str = os.environ.get("GEMINI_API_KEYS", "")
    if keys_str:
        keys = [k.strip() for k in keys_str.split(",") if k.strip()]
        if keys:
            return keys
    
    # Fallback to single environment variables
    single_keys = []
    for var in ["GEMINI_API_KEY", "GOOGLE_API_KEY", "GEMINI_API_KEY_1", "GEMINI_API_KEY_2", "GEMINI_API_KEY_3"]:
        k = os.environ.get(var, "")
        if k and k not in single_keys:
            single_keys.append(k)
    return single_keys

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
    """Convert a list of text chunks into vector embeddings using Google's API with key rotation."""
    if not texts:
        return []
        
    keys = _get_gemini_keys()
    if not keys:
        logger.warning("No Google API Key found for embeddings. Returning dummy vectors.")
        return [[0.0] * 3072 for _ in texts]
        
    last_exc = None
    for k in keys:
        try:
            genai.configure(api_key=k)
            result = genai.embed_content(
                model="models/gemini-embedding-2",
                content=texts
            )
            return result["embedding"]
        except Exception as e:
            logger.warning("Google embedding call failed, rotating key...", error=str(e))
            last_exc = e

    logger.error("All Google embedding keys failed. Returning dummy vectors.", error=str(last_exc))
    return [[0.0] * 3072 for _ in texts]
