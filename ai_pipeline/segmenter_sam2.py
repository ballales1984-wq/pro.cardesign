"""
segmenter_sam2 — Wrapper per SAM 2 (Segment Anything 2) di Meta
Livello 2 della pipeline Meshy.

Uso:
    from ai_pipeline.segmenter_sam2 import SAM2Segmenter
    seg = SAM2Segmenter(model_name="facebook/sam2-hiera-small")
    seg.load()
    result = seg.segment(image_np)  # image_np: HxWx3 uint8
"""

from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional

import logging
logger = logging.getLogger(__name__)


@dataclass
class BBox:
    x: int
    y: int
    w: int
    h: int
    confidence: float = 1.0


@dataclass
class SegmentationResult:
    mask: np.ndarray        # uint8 HxW, 0=bg, 255=object
    bboxes: list = field(default_factory=list)
    labels: list = field(default_factory=list)
    model_used: str = "none"
    image_shape: tuple = (0, 0)

    def car_bbox(self) -> Optional[BBox]:
        if not self.bboxes:
            return None
        areas = [b.w * b.h for b in self.bboxes]
        idx = int(np.argmax(areas))
        return self.bboxes[idx] if areas[idx] > 0 else None

    def mask_array(self) -> np.ndarray:
        return self.mask


class SAM2Segmenter:
    """Segment Anything 2 — Meta.

    Modelli disponibili:
      facebook/sam2-hiera-tiny       ~ 38M params, fastest
      facebook/sam2-hiera-small      ~ 46M params, good quality/speed
      facebook/sam2-hiera-large      ~ 224M params, best quality (GPU needed)

    Per car design consiglio `small` come default.
    """

    MODEL_CHOICES = {
        "tiny":  "facebook/sam2-hiera-tiny",
        "small": "facebook/sam2-hiera-small",
        "large": "facebook/sam2-hiera-large",
    }

    def __init__(
        self,
        model_name: str = "facebook/sam2-hiera-small",
        device: str = "auto",
    ):
        self.model_name = model_name
        self.device = device
        self.loaded = False

    # ── Load / Unload ────────────────────────────────────────────────────────

    def load(self) -> bool:
        if self.loaded:
            return True
        try:
            import torch
            self.torch = torch

            from transformers import Sam2Processor, Sam2Model
            self.processor = Sam2Processor.from_pretrained(self.model_name)
            self.model = Sam2Model.from_pretrained(self.model_name)

            if self.device == "auto":
                self.device = "cuda" if torch.cuda.is_available() else "cpu"
            self.model = self.model.to(self.device)
            self.model.eval()

            self.loaded = True
            logger.info(f"SAM2 loaded: {self.model_name} on {self.device}")
            return True

        except Exception as exc:
            logger.warning(f"SAM2 load failed ({self.model_name}): {exc}")
            self.loaded = False
            return False

    def unload(self) -> None:
        if not self.loaded:
            return
        try:
            del self.model
            del self.processor
            if hasattr(self, "torch"):
                import gc
                self.torch.cuda.empty_cache()
                gc.collect()
        except Exception:
            pass
        self.loaded = False
        logger.info("SAM2 unloaded")

    # ── Inference ─────────────────────────────────────────────────────────────

    def segment(
        self,
        image: np.ndarray,
        prompt_points: Optional[np.ndarray] = None,
        prompt_labels: Optional[np.ndarray] = None,
        box_prompts: Optional[np.ndarray] = None,
        multimask_output: bool = True,
    ) -> SegmentationResult:
        """Segmenta l'immagine.

        Args:
            image: HxWx3 uint8 RGB.
            prompt_points: 1xNx2 array di punti (x, y).
            prompt_labels: 1xN array 1=foreground, 0=background.
            box_prompts: Nx4 array [x1,y1,x2,y2].
            multimask_output: se True, ritorna 3 maschere (scegli la migliore).

        Returns:
            SegmentationResult con la maschera combinata degli oggetti segmentati.
        """
        if not self.loaded:
            self.load()
        if not self.loaded:
            raise RuntimeError("SAM2 model not loaded")

        import torch
        from PIL import Image

        h, w = image.shape[:2]
        pil_image = Image.fromarray(image)

        processor = self.processor
        model = self.model

        # Costruisci prompt se non forniti: default = centro immagine
        if prompt_points is None:
            prompt_points = np.array([[[w // 2, h // 2]]], dtype=np.float32)
        if prompt_labels is None:
            prompt_labels = np.array([[1]], dtype=np.float32)

        # Prepara input per SAM2
        inputs = processor(
            pil_image,
            input_points=prompt_points,
            input_labels=prompt_labels,
            return_tensors="pt",
        )
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        # Inference
        with torch.no_grad():
            outputs = model(**inputs)

        # Post-process maschere
        masks = processor.image_processor.post_process_masks(
            outputs.pred_masks.cpu(),
            inputs["original_sizes"].cpu(),
            inputs["reshaped_input_sizes"].cpu(),
        )

        # Prendi la maschera migliore (prima delle 3)
        mask_np = masks[0][0].numpy().astype(np.uint8) * 255

        # Se multimask: combina tutte le maschere in una sola
        if multimask_output and len(masks[0]) > 1:
            combined = np.zeros((h, w), dtype=np.uint8)
            for m in masks[0]:
                combined = np.maximum(combined, m.numpy().astype(np.uint8) * 255)
            mask_np = combined

        # Estrai bbox dalla maschera
        bboxes = self._mask_to_bboxes(mask_np, w, h)

        return SegmentationResult(
            mask=mask_np,
            bboxes=bboxes,
            model_used=f"sam2-{Path(self.model_name).name}",
            image_shape=(h, w),
        )

    # ── Box-prompt segmentation (per multi-view / pezzi specifici) ───────────

    def segment_with_boxes(
        self,
        image: np.ndarray,
        boxes: np.ndarray,
    ) -> SegmentationResult:
        """Segmenta usando box come prompt invece di punti.

        Args:
            image: HxWx3 uint8 RGB.
            boxes: Nx4 array [x1,y1,x2,y2] in pixel coordinates.

        Returns:
            SegmentationResult.
        """
        if not self.loaded:
            self.load()
        if not self.loaded:
            raise RuntimeError("SAM2 model not loaded")

        from PIL import Image
        pil_image = Image.fromarray(image)
        h, w = image.shape[:2]

        inputs = self.processor(pil_image, input_boxes=boxes, return_tensors="pt")
        inputs = {k: v.to(self.device) for k, v in inputs.items()}

        with torch.no_grad():
            outputs = self.model(**inputs)

        masks = self.processor.image_processor.post_process_masks(
            outputs.pred_masks.cpu(),
            inputs["original_sizes"].cpu(),
            inputs["reshaped_input_sizes"].cpu(),
        )

        combined = np.zeros((h, w), dtype=np.uint8)
        bboxes = []
        for m in masks[0]:
            m_np = m.numpy().astype(np.uint8) * 255
            combined = np.maximum(combined, m_np)
            bboxes.extend(self._mask_to_bboxes(m_np, w, h))

        return SegmentationResult(
            mask=combined,
            bboxes=bboxes,
            model_used=f"sam2-{Path(self.model_name).name}",
            image_shape=(h, w),
        )

    # ── Helpers ───────────────────────────────────────────────────────────────

    @staticmethod
    def _mask_to_bboxes(mask: np.ndarray, w: int, h: int) -> list:
        from scipy import ndimage
        labeled, num = ndimage.label(mask > 0)
        bboxes = []
        for i in range(1, num + 1):
            ys, xs = np.where(labeled == i)
            if len(xs) == 0:
                continue
            x1, y1 = int(xs.min()), int(ys.min())
            x2, y2 = int(xs.max()), int(ys.max())
            area = (x2 - x1) * (y2 - y1)
            if area < 100:
                continue
            bboxes.append(BBox(x1, y1, x2 - x1, y2 - y1, 1.0))
        return bboxes

    @staticmethod
    def ensure_model(model_name: str) -> str:
        """Ritorna il nome HuggingFace completo dato un alias."""
        return SAM2Segmenter.MODEL_CHOICES.get(
            model_name.lower(), model_name
        )
