try:
    from sentence_transformers import SentenceTransformer

    model = SentenceTransformer("all-MiniLM-L6-v2")
except Exception:
    model = None


def create_embedding(text: str):
    """
    Convert activity description into a numerical vector.
    Returns [] when the model is unavailable; callers treat that as zero similarity.
    """

    if not text or model is None:
        return []

    embedding = model.encode(text)

    return embedding.tolist()