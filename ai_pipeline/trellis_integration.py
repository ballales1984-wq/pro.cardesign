"""TRELLIS 2 integration module for pro.cardesign.

Wraps Microsoft's open-source TRELLIS 2 3D generative model to convert
2D images into 3D meshes. Supports local pipeline execution and HTTP
REST API mode. Outputs are saved as .obj or .glb files using trimesh.

TRELLIS 2 repo: https://github.com/microsoft/TRELLIS (Apache 2.0)
Conda env: trellis (Python 3.10)
"""

from __future__ import annotations

import io
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List, Dict, Any

try:
    import torch
    TORCH_AVAILABLE = True
except ImportError:
    TORCH_AVAILABLE = False

try:
    import trimesh
    TRIMESH_AVAILABLE = True
except ImportError:
    TRIMESH_AVAILABLE = False

try:
    from PIL import Image
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

try:
    import numpy as np
    NUMPY_AVAILABLE = True
except ImportError:
    NUMPY_AVAILABLE = False

try:
    import requests as req_lib
    REQUESTS_AVAILABLE = True
except ImportError:
    REQUESTS_AVAILABLE = False

try:
    from trellis.pipelines import TRELLISImagePipeline
    TRELLIS_AVAILABLE = True
except ImportError:
    TRELLIS_AVAILABLE = False

SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".webp", ".bmp"}


@dataclass
class TrellisConfig:
    """Configuration for TRELLIS 2 image-to-3D generation."""

    model_id: str = "microsoft/TRELLIS-image-large"
    resolution: int = 256
    device: str = "cuda"
    api_mode: str = "local"
    api_url: str = "http://localhost:8000"
    clean_mesh: bool = True


class TrellisIntegration:
    """Main integration class for TRELLIS 2 3D generation."""

    def __init__(self, config: Optional[TrellisConfig] = None) -> None:
        self.config = config or TrellisConfig()
        self._pipeline: Optional[Any] = None

    def check_setup(self) -> Dict[str, Any]:
        """Check TRELLIS environment and return status dict."""
        status: Dict[str, Any] = {
            "installed": TRELLIS_AVAILABLE,
            "cuda_available": False,
            "model_id": self.config.model_id,
            "version": None,
            "error": None,
        }

        if not TRELLIS_AVAILABLE:
            status["error"] = (
                "TRELLIS is not installed. "
                "Install with: pip install trellis "
                "(requires Python 3.10, torch, transformers, diffusers, trimesh, pillow, einops)"
            )
            return status

        if TORCH_AVAILABLE:
            status["cuda_available"] = torch.cuda.is_available()

        try:
            import trellis
            status["version"] = getattr(trellis, "__version__", "unknown")
        except Exception as exc:
            status["error"] = f"Failed to read TRELLIS version: {exc}"

        return status

    def _load_pipeline(self) -> Any:
        """Lazy-load the TRELLIS image pipeline."""
        if self._pipeline is not None:
            return self._pipeline

        if not TRELLIS_AVAILABLE:
            raise ImportError(
                "TRELLIS package is not installed. "
                "Install with: pip install trellis "
                "(requires Python 3.10, torch, transformers, diffusers, trimesh, pillow, einops)"
            )

        device = self.config.device
        if device == "cuda" and (not TORCH_AVAILABLE or not torch.cuda.is_available()):
            device = "cpu"
            self.config.device = "cpu"

        self._pipeline = TRELLISImagePipeline.from_pretrained(
            self.config.model_id
        )
        self._pipeline.to(device)
        return self._pipeline

    def _validate_image(self, image_path: str) -> Image.Image:
        """Load and validate an input image."""
        if not PIL_AVAILABLE:
            raise ImportError("Pillow is required for image processing.")

        path = Path(image_path)
        if not path.exists():
            raise FileNotFoundError(f"Image not found: {image_path}")

        ext = path.suffix.lower()
        if ext not in SUPPORTED_IMAGE_EXTS:
            raise ValueError(
                f"Unsupported image format: {ext}. "
                f"Supported: {sorted(SUPPORTED_IMAGE_EXTS)}"
            )

        img = Image.open(path)
        if img.mode != "RGB":
            img = img.convert("RGB")

        width, height = img.size
        if width < 64 or height < 64:
            raise ValueError(
                f"Image too small: {width}x{height}. "
                "Minimum dimensions: 64x64 pixels."
            )
        if width > 8192 or height > 8192:
            raise ValueError(
                f"Image too large: {width}x{height}. "
                "Maximum dimensions: 8192x8192 pixels."
            )

        return img

    def _post_process_mesh(self, mesh: Any) -> Any:
        """Clean up mesh: merge vertices, remove isolated components."""
        if not TRIMESH_AVAILABLE:
            return mesh

        if not isinstance(mesh, trimesh.Trimesh):
            return mesh

        mesh.merge_vertices()
        components = mesh.split(only_watertight=False)
        if len(components) > 1:
            largest = max(components, key=lambda c: c.vertices.shape[0])
            mesh = largest

        return mesh

    def _save_mesh(self, mesh: Any, output_path: str) -> str:
        """Save mesh to .obj or .glb file."""
        if not TRIMESH_AVAILABLE:
            raise ImportError("trimesh is required for mesh export.")

        if not isinstance(mesh, trimesh.Trimesh):
            raise TypeError(f"Expected trimesh.Trimesh, got {type(mesh).__name__}")

        out = Path(output_path)
        out.parent.mkdir(parents=True, exist_ok=True)

        fmt = out.suffix.lower()
        if fmt == ".glb":
            mesh.export(file_type="glb")
        else:
            mesh.export(file_type="obj")

        return str(out.resolve())

    def generate_from_image(
        self,
        image_path: str,
        config: Optional[TrellisConfig] = None,
    ) -> str:
        """Generate a 3D mesh from a single image file.

        Args:
            image_path: Path to input image.
            config: Optional TrellisConfig override.

        Returns:
            Path to saved mesh file (.obj).
        """
        cfg = config or self.config
        self.config = cfg

        img = self._validate_image(image_path)
        out_path = str(Path(image_path).with_suffix(".obj"))

        return self.generate_from_bytes(
            self._image_to_bytes(img),
            output_path=out_path,
            config=cfg,
        )

    def generate_from_bytes(
        self,
        image_bytes: bytes,
        output_path: str,
        config: Optional[TrellisConfig] = None,
    ) -> str:
        """Generate a 3D mesh from image bytes.

        Args:
            image_bytes: Raw image bytes.
            output_path: Path to save output mesh.
            config: Optional TrellisConfig override.

        Returns:
            Path to saved mesh file.
        """
        cfg = config or self.config
        self.config = cfg

        if cfg.api_mode == "api":
            return self._generate_api(image_bytes, output_path, cfg)

        if not TRELLIS_AVAILABLE:
            raise ImportError(
                "TRELLIS package is not installed. "
                "Install with: pip install trellis "
                "(requires Python 3.10, torch, transformers, diffusers, trimesh, pillow, einops)"
            )

        pipeline = self._load_pipeline()

        if not PIL_AVAILABLE:
            raise ImportError("Pillow is required for image processing.")

        img = Image.open(io.BytesIO(image_bytes))
        if img.mode != "RGB":
            img = img.convert("RGB")

        start = time.perf_counter()

        outputs = pipeline.run(
            image=img,
            clean_mesh_flag=cfg.clean_mesh,
        )

        elapsed = time.perf_counter() - start

        gaussian = outputs.get("gaussian")
        if gaussian is None:
            raise RuntimeError("TRELLIS pipeline did not return 'gaussian' output.")

        mesh = gaussian[0].extract_mesh(
            clean=cfg.clean_mesh,
            resolution=cfg.resolution,
        )

        mesh = self._post_process_mesh(mesh)
        saved_path = self._save_mesh(mesh, output_path)

        self._clear_cuda()

        return saved_path

    def generate_from_images(
        self,
        image_paths: List[str],
        output_path: str,
        config: Optional[TrellisConfig] = None,
    ) -> str:
        """Generate a 3D mesh from multiple images (multi-view).

        Args:
            image_paths: List of paths to input images.
            output_path: Path to save output mesh.
            config: Optional TrellisConfig override.

        Returns:
            Path to saved mesh file.
        """
        cfg = config or self.config
        self.config = cfg

        if not image_paths:
            raise ValueError("image_paths must contain at least one path.")

        if cfg.api_mode == "api":
            return self._generate_multi_api(image_paths, output_path, cfg)

        images = [self._validate_image(p) for p in image_paths]
        out_path = output_path or str(Path(image_paths[0]).with_suffix(".obj"))

        pipeline = self._load_pipeline()

        start = time.perf_counter()

        outputs = pipeline.run(
            image=images,
            clean_mesh_flag=cfg.clean_mesh,
        )

        elapsed = time.perf_counter() - start

        gaussian = outputs.get("gaussian")
        if gaussian is None:
            raise RuntimeError("TRELLIS pipeline did not return 'gaussian' output.")

        mesh = gaussian[0].extract_mesh(
            clean=cfg.clean_mesh,
            resolution=cfg.resolution,
        )

        mesh = self._post_process_mesh(mesh)
        saved_path = self._save_mesh(mesh, out_path)

        self._clear_cuda()

        return saved_path

    def _generate_api(
        self,
        image_bytes: bytes,
        output_path: str,
        config: TrellisConfig,
    ) -> str:
        """Generate mesh via HTTP REST API."""
        if not REQUESTS_AVAILABLE:
            raise ImportError("requests is required for API mode.")

        files = {"image": ("input.png", image_bytes, "image/png")}
        params = {
            "clean_mesh": str(config.clean_mesh).lower(),
            "resolution": config.resolution,
        }

        resp = req_lib.post(
            f"{config.api_url}/generate",
            files=files,
            data=params,
            timeout=300,
        )
        resp.raise_for_status()

        with open(output_path, "wb") as f:
            f.write(resp.content)

        return str(Path(output_path).resolve())

    def _generate_multi_api(
        self,
        image_paths: List[str],
        output_path: str,
        config: TrellisConfig,
    ) -> str:
        """Generate mesh from multiple images via HTTP REST API."""
        if not REQUESTS_AVAILABLE:
            raise ImportError("requests is required for API mode.")

        files = []
        for idx, img_path in enumerate(image_paths):
            with open(img_path, "rb") as f:
                files.append(
                    ("images", (f"image_{idx}.png", f.read(), "image/png"))
                )

        params = {
            "clean_mesh": str(config.clean_mesh).lower(),
            "resolution": config.resolution,
        }

        resp = req_lib.post(
            f"{config.api_url}/generate_multi",
            files=files,
            data=params,
            timeout=600,
        )
        resp.raise_for_status()

        with open(output_path, "wb") as f:
            f.write(resp.content)

        return str(Path(output_path).resolve())

    def _image_to_bytes(self, img: Any) -> bytes:
        """Convert PIL Image to PNG bytes."""
        buf = io.BytesIO()
        img.save(buf, format="PNG")
        return buf.getvalue()

    def _clear_cuda(self) -> None:
        """Clear CUDA cache to free GPU memory."""
        if TORCH_AVAILABLE and torch.cuda.is_available():
            torch.cuda.empty_cache()


def _print_status(status: Dict[str, Any]) -> None:
    """Print setup status in a readable format."""
    print("TRELLIS Integration Status")
    print(f"  installed:       {status['installed']}")
    print(f"  cuda_available:  {status['cuda_available']}")
    print(f"  model_id:        {status['model_id']}")
    print(f"  version:         {status['version']}")
    if status["error"]:
        print(f"  error:           {status['error']}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(f"Usage: python {sys.argv[0]} <image_path> [output_path]")
        print(f"Supported formats: {sorted(SUPPORTED_IMAGE_EXTS)}")
        sys.exit(1)

    image_path = sys.argv[1]
    output_path = sys.argv[2] if len(sys.argv) > 2 else "./output/test_trellis.obj"

    config = TrellisConfig()
    integration = TrellisIntegration(config)

    status = integration.check_setup()
    _print_status(status)

    if not status["installed"]:
        sys.exit(1)

    print(f"\nGenerating 3D mesh from: {image_path}")

    total_start = time.perf_counter()

    try:
        result_path = integration.generate_from_image(
            image_path=image_path,
            config=config,
        )
        elapsed = time.perf_counter() - total_start
        print(f"Mesh saved to: {result_path}")
        print(f"Total time: {elapsed:.2f}s")
    except Exception as exc:
        print(f"Generation failed: {exc}")
        sys.exit(1)
