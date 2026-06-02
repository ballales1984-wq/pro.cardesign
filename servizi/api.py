"""
servizi/api.py — API FastAPI per la pipeline AI "foto → 3D"

Endpoints:
  POST /api/v1/segment   — Segmentazione SAM2 da immagine
  POST /api/v1/depth     — Depth estimation da immagine
  POST /api/v1/process   — Pipeline completa 2D→3D (depth + segmenta + voxels)

Avvia con:
  uvicorn servizi.api:app --host 0.0.0.0 --port 8000 --reload
"""

from __future__ import annotations
import io
import time
import logging
import numpy as np
from pathlib import Path
from typing import Optional

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

logger = logging.getLogger(__name__)

# ── Import pipeline AI ──────────────────────────────────────────────────────
import sys
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from ai_pipeline.segmenter_sam2 import SAM2Segmenter
from ai_pipeline.depth_estimator import DepthEstimator

# ── FastAPI app ─────────────────────────────────────────────────────────────
app = FastAPI(
    title="pro.cardesign AI API",
    description="Pipeline foto→3D per car design",
    version="0.1.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Models ──────────────────────────────────────────────────────────────────
class SegmentResponse(BaseModel):
    success: bool
    model_used: str
    mask_shape: tuple[int, int]
    bbox_count: int
    car_bbox: Optional[dict] = None
    processing_ms: int
    error: Optional[str] = None


class DepthResponse(BaseModel):
    success: bool
    model_used: str
    depth_shape: tuple[int, int]
    processing_ms: int
    error: Optional[str] = None


class ProcessResponse(BaseModel):
    success: bool
    voxel_count: int
    depth_model: str
    segment_model: str
    processing_ms: int
    error: Optional[str] = None


# ── Lazy singletons (caricati al primo request) ─────────────────────────────
_segmenter: SAM2Segmenter | None = None
_depth_estimator: DepthEstimator | None = None


def get_segmenter() -> SAM2Segmenter:
    global _segmenter
    if _segmenter is None:
        _segmenter = SAM2Segmenter(model_name="facebook/sam2-hiera-small")
        _segmenter.load()
    return _segmenter


def get_depth_estimator() -> DepthEstimator:
    global _depth_estimator
    if _depth_estimator is None:
        _depth_estimator = DepthEstimator()
    return _depth_estimator


# ── Helpers ─────────────────────────────────────────────────────────────────
def _decode_image(upload: UploadFile) -> np.ndarray:
    try:
        from PIL import Image
        img = Image.open(io.BytesIO(upload.file.read()))
        if img.mode != "RGB":
            img = img.convert("RGB")
        return np.array(img)
    except Exception as exc:
        raise HTTPException(400, f"Immagine non valida: {exc}")


# ── Endpoints ───────────────────────────────────────────────────────────────

@app.get("/health")
async def health():
    return {"status": "ok", "service": "pro.cardesign AI API"}


@app.post("/api/v1/segment", response_model=SegmentResponse)
async def segment_image(file: UploadFile = File(...)):
    t0 = time.perf_counter()
    try:
        image = _decode_image(file)
        segmenter = get_segmenter()
        result = segmenter.segment(image)

        car_bbox = result.car_bbox()
        response = SegmentResponse(
            success=True,
            model_used=result.model_used,
            mask_shape=tuple(result.mask.shape),
            bbox_count=len(result.bboxes),
            car_bbox={
                "x": car_bbox.x, "y": car_bbox.y,
                "w": car_bbox.w, "h": car_bbox.h,
                "confidence": car_bbox.confidence,
            } if car_bbox else None,
            processing_ms=int((time.perf_counter() - t0) * 1000),
        )
        logger.info(f"Segment: {result.model_used}, {len(result.bboxes)} bboxes, {response.processing_ms}ms")
        return response

    except Exception as exc:
        logger.exception("Segment error")
        return SegmentResponse(
            success=False, model_used="none", mask_shape=(0, 0),
            bbox_count=0, processing_ms=int((time.perf_counter() - t0) * 1000),
            error=str(exc),
        )


@app.post("/api/v1/depth", response_model=DepthResponse)
async def estimate_depth(file: UploadFile = File(...)):
    t0 = time.perf_counter()
    try:
        image = _decode_image(file)
        estimator = get_depth_estimator()
        depth_map = estimator.estimate_depth(image)

        response = DepthResponse(
            success=True,
            model_used=depth_map.model_used,
            depth_shape=(depth_map.height, depth_map.width),
            processing_ms=int((time.perf_counter() - t0) * 1000),
        )
        logger.info(f"Depth: {depth_map.model_used}, {response.processing_ms}ms")
        return response

    except Exception as exc:
        logger.exception("Depth error")
        return DepthResponse(
            success=False, model_used="none", depth_shape=(0, 0),
            processing_ms=int((time.perf_counter() - t0) * 1000),
            error=str(exc),
        )


@app.post("/api/v1/process", response_model=ProcessResponse)
async def process_image(file: UploadFile = File(...)):
    """Pipeline completa: depth + segmentazione + voxelizzazione."""
    t0 = time.perf_counter()
    try:
        from ai_pipeline.pipeline import AIPipeline
        pipeline = AIPipeline(mode="fast")

        image = _decode_image(file)
        result = pipeline.process_image(image, domain="vehicle")

        response = ProcessResponse(
            success=result.success,
            voxel_count=len(result.voxels),
            depth_model=result.depth_map.model_used if result.depth_map else "none",
            segment_model=result.segmentation_mask.model_used if result.segmentation_mask else "none",
            processing_ms=int((time.perf_counter() - t0) * 1000),
            error="; ".join(result.errors) if result.errors else None,
        )
        logger.info(f"Process: {result.success}, {len(result.voxels)} voxels, {response.processing_ms}ms")
        return response

    except Exception as exc:
        logger.exception("Process error")
        return ProcessResponse(
            success=False, voxel_count=0,
            depth_model="none", segment_model="none",
            processing_ms=int((time.perf_counter() - t0) * 1000),
            error=str(exc),
        )


if __name__ == "__main__":
    import uvicorn
    logging.basicConfig(level=logging.INFO)
    uvicorn.run(app, host="0.0.0.0", port=8000, log_level="info")
