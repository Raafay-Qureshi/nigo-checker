"""FastAPI extraction service. One endpoint: POST /extract.

Reads the uploaded PDFs with pypdf, calls the LLM (DeepSeek by default), and returns the
packet in the shape the JS rules engine consumes: a plain-value `packet` plus a flat
`confidence` map of dotted field paths to the model's 0..1 confidence.

Run:  uvicorn main:app --port 8001   (from the extractor/ directory)"""
import io

from fastapi import FastAPI, UploadFile
from pypdf import PdfReader

from llm import call_llm

app = FastAPI(title="NIGO Checker extractor")


def pdf_bytes_to_text(data: bytes) -> str:
    reader = PdfReader(io.BytesIO(data))
    return "\n".join((page.extract_text() or "") for page in reader.pages)


def normalize(extracted: dict, prefix: str = "", confidence: dict | None = None):
    """Collapse {value, confidence} nodes to plain values, collecting a flat confidence
    map keyed by dotted path. Lists and plain scalars pass through unchanged."""
    if confidence is None:
        confidence = {}
    if isinstance(extracted, dict):
        keys = set(extracted.keys())
        if keys == {"value", "confidence"}:
            confidence[prefix] = extracted.get("confidence", 0.0)
            return extracted.get("value"), confidence
        out = {}
        for k, v in extracted.items():
            path = f"{prefix}.{k}" if prefix else k
            out[k], _ = normalize(v, path, confidence)
        return out, confidence
    return extracted, confidence


@app.post("/extract")
async def extract(files: list[UploadFile]):
    parts = [pdf_bytes_to_text(await f.read()) for f in files]
    text = "\n".join(parts)
    raw = call_llm(text)
    packet, confidence = normalize(raw)
    return {"packet": packet, "confidence": confidence}


@app.get("/health")
def health():
    return {"ok": True}
