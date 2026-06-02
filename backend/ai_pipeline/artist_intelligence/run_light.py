from __future__ import annotations
import argparse
from pathlib import Path
from .main_pipeline import ArtistPipeline
from .config import ensure_directories


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Run the Light Artist Intelligence pipeline.")
    parser.add_argument("image", type=Path, help="Input image path")
    parser.add_argument("--output", type=Path, default=Path("outputs"), help="Output folder")
    parser.add_argument("--verbose", action="store_true", help="Print detailed stage results")
    return parser.parse_args()


def save_results(result, output_dir: Path) -> None:
    output_dir.mkdir(parents=True, exist_ok=True)
    summary_path = output_dir / "pipeline_summary.txt"
    summary_path.write_text(str(result.summary()))

    if "segmentation" in result.outputs:
        mask = result.outputs["segmentation"].get("mask")
        if mask is not None:
            import numpy as np
            from PIL import Image
            Image.fromarray(mask).save(output_dir / "segmentation_mask.png")

    if "depth" in result.outputs:
        depth_map = result.outputs["depth"].get("depth_map")
        if hasattr(depth_map, "data"):
            import numpy as np
            from PIL import Image
            depth_norm = (depth_map.data * 255).astype(np.uint8)
            Image.fromarray(depth_norm).save(output_dir / "depth_map.png")

    if "lifting" in result.outputs:
        pc = result.outputs["lifting"].get("point_cloud")
        if pc is not None and hasattr(pc, "save_npz"):
            pc.save_npz(output_dir / "point_cloud.npz")

    if "refiner" in result.outputs:
        mesh = result.outputs["refiner"].get("mesh")
        if mesh is not None and hasattr(mesh, "save_obj"):
            mesh.save_obj(output_dir / "refined_mesh.obj")

    if "voxelization" in result.outputs:
        vg = result.outputs["voxelization"].get("voxel_grid")
        if vg is not None and hasattr(vg, "save_json"):
            vg.save_json(output_dir / "voxel_grid.json")


def main() -> None:
    args = parse_args()
    ensure_directories()
    pipeline = ArtistPipeline()
    result = pipeline.run(args.image)

    print("Pipeline success:", result.success)
    print("Summary:", result.summary())
    if args.verbose:
        for name, stage in result.stage_results.items():
            print(f"[{name}] success={stage.success} model={stage.metadata.get('model')} error={stage.error}")

    save_results(result, args.output)
    print("Outputs written to:", args.output)


if __name__ == "__main__":
    main()
