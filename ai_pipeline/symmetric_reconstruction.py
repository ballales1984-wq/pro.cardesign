"""
symmetric_reconstruction — Ricostruzione simmetrica per car body
Livello 3: sfrutta la simmetria laterale delle auto per completare
la mesh da un solo lato.
"""

from __future__ import annotations
import numpy as np
from dataclasses import dataclass, field
from pathlib import Path
from typing import Optional, Tuple
import logging

logger = logging.getLogger(__name__)


@dataclass
class SymmetricMeshResult:
    left_vertices: np.ndarray
    right_vertices: np.ndarray
    full_vertices: np.ndarray
    full_faces: np.ndarray
    symmetry_axis: float = 0.0
    mirror_quality: float = 0.0

    @property
    def vertex_count(self) -> int:
        return int(self.full_vertices.shape[0])

    @property
    def face_count(self) -> int:
        return int(self.full_faces.shape[0])

    def save_obj(self, path: str | Path) -> Path:
        path = Path(path)
        path.parent.mkdir(parents=True, exist_ok=True)
        lines = ["o symmetric_car_mesh\n"]
        for v in self.full_vertices:
            lines.append(f"v {v[0]:.6f} {v[1]:.6f} {v[2]:.6f}\n")
        for f in self.full_faces + 1:
            lines.append(f"f {f[0]} {f[1]} {f[2]}\n")
        path.write_text("".join(lines))
        return path


class SymmetricReconstructor:
    def __init__(self, axis: str = "x"):
        self.axis = axis
        self.axis_idx = {"x": 0, "y": 1, "z": 2}[axis]

    def complete_from_half(self, half_mesh) -> SymmetricMeshResult:
        vertices = half_mesh.vertices.astype(np.float32)
        faces = half_mesh.faces.astype(np.int32)
        min_coord = vertices[:, self.axis_idx].min()
        max_coord = vertices[:, self.axis_idx].max()
        center = (min_coord + max_coord) / 2.0
        col = self.axis_idx

        left_mask = vertices[:, col] <= center
        right_mask = ~left_mask

        left_verts = vertices[left_mask].copy()
        right_verts = vertices[right_mask].copy()

        left_faces = faces.copy()

        mirror_offset = (center - right_verts[:, col]) * 2
        mirrored_right = right_verts.copy()
        mirrored_right[:, col] = right_verts[:, col] + mirror_offset

        quality = self._compute_symmetry_quality(left_verts, right_verts, mirrored_right)

        if np.sum(left_mask) > np.sum(right_mask):
            base_verts = left_verts
            right_component = mirrored_right
        else:
            base_verts = right_verts
            right_component = left_verts

        full_vertices = self._merge_vertices(base_verts, right_component)

        full_faces = self._build_full_faces(
            half_faces=faces, half_verts=vertices,
            full_verts=full_vertices, center=center
        )

        logger.info(f"Symmetry: centro={center:.2f}, "
                    f"vert={full_vertices.shape[0]}, facce={full_faces.shape[0]}, "
                    f"qualità={quality:.2f}")

        return SymmetricMeshResult(
            left_vertices=left_verts,
            right_vertices=right_verts,
            full_vertices=full_vertices,
            full_faces=full_faces,
            symmetry_axis=center,
            mirror_quality=quality
        )

    def _compute_symmetry_quality(self, left: np.ndarray,
                                  right: np.ndarray,
                                  right_mirrored: np.ndarray) -> float:
        if len(left) == 0 or len(right_mirrored) == 0:
            return 0.0
        lc = left.mean(axis=0)
        rc = right_mirrored.mean(axis=0)
        diff = np.abs(lc - rc)
        scale = (left.max(axis=0) - left.min(axis=0)).sum()
        if scale < 1e-6:
            return 0.0
        dist = np.linalg.norm(lc - rc) / (scale + 1e-6)
        return max(0.0, min(1.0, 1.0 - dist))

    def _merge_vertices(self, side_a: np.ndarray,
                        side_b: np.ndarray,
                        tolerance: float = 1e-3) -> np.ndarray:
        merged = [side_a]
        for v_b in side_b:
            dists = np.linalg.norm(side_a - v_b.reshape(1, -1), axis=1)
            if dists.min() > tolerance:
                merged.append(v_b.reshape(1, -1))
        return np.vstack(merged).astype(np.float32)

    def _build_full_faces(self, half_faces: np.ndarray,
                          half_verts: np.ndarray,
                          full_verts: np.ndarray,
                          center: float) -> np.ndarray:
        n_half = int(half_verts.shape[0])
        col = self.axis_idx

        right_indices = np.where(half_verts[:, col] > center)[0]
        left_indices = np.where(half_verts[:, col] <= center)[0]

        offset_map = {}
        for ri in right_indices:
            v = half_verts[ri]
            mirrored = v.copy()
            mirrored[col] = 2 * center - v[col]
            dists = np.linalg.norm(full_verts - mirrored.reshape(1, -1), axis=1)
            nearest = int(np.argmin(dists))
            if dists[nearest] < 0.01:
                offset_map[ri] = nearest

        new_faces = []
        for f in half_faces:
            mapped = []
            needs_mirror = False
            for vi in f:
                if vi in offset_map:
                    mapped.append(offset_map[vi])
                    needs_mirror = True
                else:
                    mapped.append(int(vi))
            new_faces.append(mapped)
            if needs_mirror:
                mirror_f = [mapped[0], mapped[2], mapped[1]]
                if len(set(mirror_f)) == 3:
                    new_faces.append(mirror_f)

        new_faces.extend([f.copy()[::-1] for f in half_faces if True])
        result = np.array(new_faces, dtype=np.int32)
        return result[result.max(axis=1) < full_verts.shape[0]] if result.size else result[:0]
