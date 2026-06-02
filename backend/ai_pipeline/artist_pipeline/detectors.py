"""
detectors — Object Detection + SAM 2 Segmentation for the Artist 3D Pipeline.
Steps:
    1. Run a lightweight car detector to find the bounding box.
    2. Use SAM 2 to generate a high-quality segmentation mask from the bbox.
    3. Fall back to full-image SAM 2 point-prompt segmentation if detector fails.
"""

from __future__ import annotations
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Tuple, List

import numpy as np

from .config import PipelineConfig, DetectionConfig
from .utils import setup_logging, bbox_area, clamp

logger = setup_logging()


@dataclass
class DetectionResult:
    bbox: Optional[np.ndarray]   # [x1, y1, x2, y2] or None
    confidence: float = 0.0
    label: str = "car"
    model_used: str = "none"
    inference_time_ms: float = 0.0


@dataclass
class SegmentationResult:
    mask: np.ndarray             # uint8 HxW, 0=bg, 255=fg
    bboxes: list = field(default_factory=list)
    model_used: str = "none"
    inference_time_ms: float = 0.0

    def best_bbox(self) -> Optional[Tuple[int, int, int, int]]:
        if not self.bboxes:
            return None
        areas = [bbox_area(b) for b in self.bboxes]
        idx = int(np.argmax(areas))
        if areas[idx] <= 0:
            return None
        b = self.bboxes[idx]
        return (int(b[0]), int(b[1]), int(b[2]), int(b[3]))


def _try_detect_car(image: np.ndarray, conf_threshold: float = 0.5) -> Optional[DetectionResult]:
    try:
        from transformers import AutoImageProcessor, AutoModelForObjectDetection
        t0 = time.perf_counter()
        processor = AutoImageProcessor.from_pretrained("facebook/detr-resnet-50")
        model = AutoModelForObjectDetection.from_pretrained("facebook/detr-resnet-50")
        from PIL import Image
        pil_img = Image.fromarray(image)
        inputs = processor(images=pil_img, return_tensors="pt")
        import torch
        with torch.no_grad():
            outputs = model(**inputs)
        target_sizes = torch.tensor([pil_img.size[::-1]])
        results = processor.post_process_object_detection(outputs, target_sizes=target_sizes, threshold=conf_threshold)
        dt = (time.perf_counter() - t0) * 1000
        boxes = results[0]["boxes"].cpu().numpy() if len(results) > 0 else np.empty((0, 4))
        labels = results[0]["labels"].cpu().numpy() if len(results) > 0 else np.empty((0,), dtype=int)
        scores = results[0]["scores"].cpu().numpy() if len(results) > 0 else np.empty((0,), dtype=float)
        COCO_CAR = 2  # COCO label index for car in detr-resnet-50
        for i in range(len(labels)):
            if labels[i] == COCO_CAR:
                return DetectionResult(
                    bbox=boxes[i].astype(np.float32),
                    confidence=float(scores[i]),
                    label="car",
                    model_used="detr-resnet-50",
                    inference_time_ms=dt,
                )
        best_idx = int(np.argmax(scores)) if len(scores) > 0 else -1
        if best_idx >= 0:
            return DetectionResult(
                bbox=boxes[best_idx].astype(np.float32),
                confidence=float(scores[best_idx]),
                label=str(labels[best_idx]),
                model_used="detr-resnet-50",
                inference_time_ms=dt,
            )
    except Exception as exc:
        logger.warning(f"DETR detection failed: {exc}")
    return None


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
        bboxes.append((x1, y1, x2, y2))
    return bboxes


def _try_sam2_segment_full(
    image: np.ndarray,
    model_name: str = "facebook/sam2-hiera-small",
) -> Optional[np.ndarray]:
    try:
        import torch
        from transformers import Sam2Processor, Sam2Model
        from PIL import Image
        t0 = time.perf_counter()
        device = "cuda" if torch.cuda.is_available() else "cpu"
        processor = Sam2Processor.from_pretrained(model_name)
        model = Sam2Model.from_pretrained(model_name)
        model = model.to(device)
        model.eval()
        pil_img = Image.fromarray(image)
        h, w = image.shape[:2]
        points = torch.tensor([[[w / 2.0, h / 2.0]]], dtype=torch.float32, device=device)
        labels = torch.tensor([[1]], dtype=torch.float32, device=device)
        inputs = processor(pil_img, input_points=points, input_labels=labels, return_tensors="pt")
        inputs = {k: v.to(device) for k, v in inputs.items()}
        with torch.no_grad():
            outputs = model(**inputs)
        masks = processor.image_processor.post_process_masks(
            outputs.pred_masks.cpu(),
            inputs["original_sizes"].cpu(),
            inputs["reshaped_input_sizes"].cpu(),
        )
        best = masks[0][0].numpy().astype(np.uint8) * 255
        if len(masks[0]) > 1:
            combined = np.zeros((h, w), dtype=np.uint8)
            for m in masks[0]:
                combined = np.maximum(combined, m.numpy().astype(np.uint8) * 255)
            best = combined
        dt = (time.perf_counter() - t0) * 1000
        logger.info(f"SAM2 full-image segmentation: {dt:.0f}ms")
        del model, processor
        if device == "cuda":
            torch.cuda.empty_cache()
        return best
    except Exception as exc:
        logger.warning(f"SAM2 segmentation failed: {exc}")
    return None


def _fallback_mask(image: np.ndarray) -> np.ndarray:
    h, w = image.shape[:2]
    gray = image.mean(axis=2).astype(np.float32)
    gy, gx = np.gradient(gray)
    edges = np.sqrt(gx ** 2 + gy ** 2)
    edge_norm = edges / (edges.max() + 1e-6)
    weight = 1.0 - edge_norm
    center_x, center_y = w / 2.0, h / 2.0
    ys, xs = np.mgrid[0:h, 0:w].astype(np.float32)
    dist = np.sqrt((xs - center_x) ** 2 + (ys - center_y) ** 2)
    max_dist = np.sqrt(center_x ** 2 + center_y ** 2)
    radial = 1.0 - (dist / (max_dist + 1e-6))
    saliency = 0.7 * weight + 0.3 * radial
    mask = (saliency > np.percentile(saliency, 30)).astype(np.uint8) * 255
    from scipy import ndimage
    mask = ndimage.binary_fill_holes(mask > 0).astype(np.uint8) * 255
    return mask


def detect_and_segment(
    image: np.ndarray,
    config: Optional[PipelineConfig] = None,
) -> Tuple[np.ndarray, np.ndarray]:
    """Detect + segment the main object (preferably a car) from the image.

    Args:
        image: HxWx3 uint8 RGB.
        config: PipelineConfig (uses default config if None).

    Returns:
        (segmented_image, mask) — image with background zeroed out, mask 0/255.
    """
    if config is None:
        config = PipelineConfig()
    det_cfg = config.detection
    h, w = image.shape[:2]

    detection: Optional[DetectionResult] = None
    if det_cfg.confidence_threshold > 0:
        try:
            detection = _try_detect_car(image, conf_threshold=det_cfg.confidence_threshold)
        except Exception as exc:
            logger.warning(f"Car detection error: {exc}")

    mask = np.zeros((h, w), dtype=np.uint8)
    seg_model = "none"

    if detection is not None and detection.bbox is not None:
        x1, y1, x2, y2 = detection.bbox.astype(int)
        x1, y1 = clamp(x1, 0, w - 1), clamp(y1, 0, h - 1)
        x2, y2 = clamp(x2, 1, w), clamp(y2, 1, h)
        crop = image[y1:y2, x1:x2].copy()
        sam_mask = _try_sam2_segment_full(crop, model_name=det_cfg.model_name)
        if sam_mask is not None:
            full_mask = np.zeros((h, w), dtype=np.uint8)
            full_mask[y1:y2, x1:x2] = sam_mask
            mask = full_mask
            seg_model = f"sam2-{det_cfg.model_name} (bbox-prompt)"
        else:
            mask = _fallback_mask(image)
            seg_model = "fallback (detection only)"
    else:
        if det_cfg.fallback_to_full_image:
            sam_mask = _try_sam2_segment_full(image, model_name=det_cfg.model_name)
            if sam_mask is not None:
                mask = sam_mask
                seg_model = f"sam2-{det_cfg.model_name} (center-prompt)"
            else:
                mask = _fallback_mask(image)
                seg_model = "fallback"
        else:
            mask = _fallback_mask(image)
            seg_model = "fallback"

    bboxes = _mask_to_bboxes(mask, w, h)
    seg = SegmentationResult(mask=mask, bboxes=bboxes, model_used=seg_model)
    logger.info(f"Segmentation done: model={seg_model}, bboxes={len(bboxes)}, mask_sum={mask.sum()}")

    segmented_img = image.copy()
    segmented_img[mask == 0] = 0

    return segmented_img, mask
