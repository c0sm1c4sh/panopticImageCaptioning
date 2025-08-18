# FastAPI app
import io
from typing import Optional
from fastapi import FastAPI, UploadFile, File, Form
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from PIL import Image
import torch

from .panoptic_utils import Models, run_inference

app = FastAPI(title="Panoptic Caption API")

# For demo allow all origins (lock this down in production)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Lazy-load heavy models once
_MODELS: Optional[Models] = None

def get_models() -> Models:
    global _MODELS
    if _MODELS is None:
        device = 0 if torch.cuda.is_available() else -1
        _MODELS = Models(device=device)
    return _MODELS

@app.get("/api/health")
async def health():
    return {"status": "ok"}

@app.post("/api/caption")
async def caption(topk: int = Form(8), file: UploadFile = File(...)):
    try:
        content = await file.read()
        image = Image.open(io.BytesIO(content)).convert("RGB")
        models = get_models()
        out = run_inference(models, image, topk=topk)
        return JSONResponse(out)
    except Exception as e:
        return JSONResponse({"error": str(e)}, status_code=500)
