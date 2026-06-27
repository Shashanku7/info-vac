import pytest
from backend.embeddings import chunk_text

def test_chunk_text_empty():
    assert chunk_text("") == []
    assert chunk_text(None) == []

def test_chunk_text_splits_large_text():
    text = "A" * 1500
    chunks = chunk_text(text, chunk_size=600, chunk_overlap=100)
    # 1500 chars should be at least 3 chunks
    assert len(chunks) >= 3
    assert all(len(c) <= 600 for c in chunks)

def test_chunk_text_preserves_sentences():
    text = "This is sentence one. This is sentence two.\n\nThis is a new paragraph."
    # With a small chunk size, it should split at newlines or periods
    chunks = chunk_text(text, chunk_size=30, chunk_overlap=0)
    assert len(chunks) > 1
