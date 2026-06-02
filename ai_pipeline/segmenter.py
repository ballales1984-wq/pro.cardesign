"""
segmenter — Segmentazione oggetti per isolare l'auto
Livello 2 della pipeline Meshy.
Supporta: SAM 2, YOLO Segmentation, fallback bbox.
"""

from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, List, Tuple
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
class SegmentationMask:
    mask: np.ndarray       # uint8, HxW, 0=background, 255=object
    bboxes: List[BBox] = field(default_factory=list)
    labels: List[str] = field(default_factory=list)
    model_used: str = "none"
    image_shape: Tuple[int, int] = (0, 0)

    def car_bbox(self) -> Optional[BBox]:
        """Restituisce il bbox più grande che potrebbe essere un'auto."""
        if not self.bboxes:
            return None
        areas = [b.w * b.h for b in self.bboxes]
        idx = int(np.argmax(areas))
        return self.bboxes[idx] if areas[idx] > 0 else None

    def mask_array(self) -> np.ndarray:
        return self.mask

    def save(self, path: str | Path) -> Path:
        from PIL import Image
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        Image.fromarray(self.mask).save(path)
        (path.parent / (path.stem + "_meta.json")).write_text(
            f'{{"model": "{self.model_used}", "shape": {list(self.image_shape)}, '
            f'"bboxes": {len(self.bboxes)}}}\n'
        )
        return path


class CarSegmenter:
    def __init__(self, model: str = "auto"):
        self.model_name = model
        self._segmenter = None

    def load(self) -> bool:
        try:
            from transformers import SamProcessor, SamModel
            self._processor = SamProcessor.from_pretrained("facebook/sam2-hiera-small")
            self._model = SamModel.from_pretrained("facebook/sam2-hiera-small")
            import torch
            self._torch = torch
            self._model_name_loaded = "sam2-hiera-small"
            self._load_method = "sam"
            logger.info("SAM 2 model loaded")
            return True
        except Exception as e:
            logger.warning(f"SAM 2 load failed: {e}. Trying YOLO...")
        try:
            from ultralytics import YOLO
            self._yolo = YOLO("yolov8n-seg.pt")
            self._model_name_loaded = "yolov8n-seg"
            self._load_method = "yolo"
            logger.info("YOLOv8 segmentation model loaded")
            return True
        except Exception as e:
            logger.warning(f"YOLO load failed: {e}")
        self._model_name_loaded = "fallback"
        self._load_method = "none"
        return False

    def segment_car(self, image: np.ndarray,
                    prompt: Optional[np.ndarray] = None) -> SegmentationMask:
        self.load()
        h, w = image.shape[:2]
        if self._load_method == "sam" and self._model is not None:
            return self._segment_sam(image, w, h, prompt)
        elif self._load_method == "yolo" and self._yolo is not None:
            return self._segment_yolo(image, w, h)
        return self._segment_fallback(image, w, h)

    def _segment_sam(self, image: np.ndarray, w: int, h: int,
                     prompt_points: Optional[np.ndarray]) -> SegmentationMask:
        import torch
        from PIL import Image
        center = np.array([[[w // 2, h // 2]]], dtype=np.float32)
        labels = np.array([[1]], dtype=np.float32)

        inputs = self._processor(
            image, input_points=center, input_labels=labels, return_tensors="pt"
        )
        with torch.no_grad():
            outputs = self._model(**inputs)
            masks = self._processor.image_processor.post_process_masks(
                outputs.pred_masks.cpu(),
                inputs["original_sizes"].cpu(),
                inputs["reshaped_input_sizes"].cpu()
            )
        mask = masks[0][0].numpy().astype(np.uint8) * 255
        bboxes = self._mask_to_bboxes(mask, w, h)
        return SegmentationMask(
            mask=mask, bboxes=bboxes,
            model_used="sam2-" + self._model_name_loaded,
            image_shape=(h, w)
        )

    def _segment_yolo(self, image: np.ndarray, w: int, h: int) -> SegmentationMask:
        results = self._yolo(image, verbose=False, conf=0.3)
        mask = np.zeros((h, w), dtype=np.uint8)
        bboxes = []
        labels = []
        for r in results:
            if r.masks is not None:
                for m, box, cls in zip(r.masks.data, r.boxes.xyxy, r.boxes.cls):
                    m_np = (m.cpu().numpy() > 0.5).astype(np.uint8) * 255
                    mask = np.maximum(mask, m_np)
                    x1, y1, x2, y2 = box.cpu().numpy().astype(int)
                    bboxes.append(BBox(x1, y1, x2 - x1, y2 - y1,
                                       float(r.boxes.conf[0].cpu())))
                    labels.append(self._yolo.names.get(int(cls.cpu()), "object"))
        return SegmentationMask(
            mask=mask, bboxes=bboxes, labels=labels,
            model_used=self._model_name_loaded, image_shape=(h, w)
        )

    def _segment_fallback(self, image: np.ndarray, w: int, h: int) -> SegmentationMask:
        gray = image.mean(axis=2) if len(image.shape) > 2 else image
        mask = np.ones((h, w), dtype=np.uint8) * 255
        thresh = np.percentile(gray, 15)
        mask[gray < thresh] = 0
        from scipy import ndimage
        labeled, num = ndimage.label(mask > 0)
        areas = ndimage.sum(mask > 0, labeled, range(1, num + 1))
        if len(areas) > 0:
            largest = np.argmax(areas) + 1
            mask = (labeled == largest).astype(np.uint8) * 255
        bboxes = self._mask_to_bboxes(mask, w, h)
        return SegmentationMask(
            mask=mask, bboxes=bboxes,
            model_used="fallback_connected_components",
            image_shape=(h, w)
        )

    @staticmethod
    def _mask_to_bboxes(mask: np.ndarray, w: int, h: int) -> List[BBox]:
        from scipy import ndimage
        labeled, num = ndimage.label(mask > 0)
        bboxes = []
        for i in range(1, num + 1):
            ys, xs = np.where(labeled == i)
            if len(xs) == 0:
                continue
            x1, y1 = int(xs.min()), int(ys.min())
            x2, y2 = int(xs.max()), int(ys.max())
            bboxes.append(BBox(x1, y1, x2 - x1, y2 - y1, 1.0))
        return bboxes
