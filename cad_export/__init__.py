"""
cad_export — Esportazione mesh in standard CAD / 3D
Supportati: STL (ascii/binary), OBJ (base), JSON pro.cardesign
"""

from __future__ import annotations
import json
import struct
import math
from pathlib import Path
from typing import List, Optional

from geometry_core import Triangolo, Mesh3D


# ─────────────────────────────────────────────────────────────────────────────
# Helpers interni
# ─────────────────────────────────────────────────────────────────────────────

def _triangoli_da_mesh(mesh: Mesh3D) -> List[Triangolo]:
    return mesh.facce


def _normalizza_normale(t: Triangolo) -> tuple[float, float, float]:
    n = t.normale
    mag = math.sqrt(n.x ** 2 + n.y ** 2 + n.z ** 2)
    if mag == 0:
        return (0.0, 0.0, 1.0)
    return (n.x / mag, n.y / mag, n.z / mag)


# ─────────────────────────────────────────────────────────────────────────────
# STL ASCII
# ─────────────────────────────────────────────────────────────────────────────

def esporta_stl_ascii(mesh: Mesh3D,
                      nome_oggetto: str = "procardesign") -> str:
    """
    Esporta Mesh3D in formato STL ASCII.
    Restituisce la stringa pronta per essere scritta su file.
    """
    righe = [f"solid {nome_oggetto}"]
    facce = _triangoli_da_mesh(mesh)
    for f in facce:
        nx, ny, nz = _normalizza_normale(f)
        righe.append(
            f"  facet normal {nx:.6e} {ny:.6e} {nz:.6e}\n"
            f"    outer loop\n"
            f"      vertex {f.a.x:.6f} {f.a.y:.6f} {f.a.z:.6f}\n"
            f"      vertex {f.b.x:.6f} {f.b.y:.6f} {f.b.z:.6f}\n"
            f"      vertex {f.c.x:.6f} {f.c.y:.6f} {f.c.z:.6f}\n"
            f"    endloop\n"
            f"  endfacet"
        )
    righe.append(f"endsolid {nome_oggetto}")
    return "\n".join(righe) + "\n"


def salva_stl_ascii(mesh: Mesh3D,
                    percorso: str | Path,
                    nome_oggetto: str = "procardesign") -> Path:
    percorso = Path(percorso)
    percorso.write_text(esporta_stl_ascii(mesh, nome_oggetto), encoding="utf-8")
    return percorso


# ─────────────────────────────────────────────────────────────────────────────
# STL Binary
# ─────────────────────────────────────────────────────────────────────────────

def esporta_stl_binary(mesh: Mesh3D,
                       nome_oggetto: str = "procardesign") -> bytes:
    """
    Esporta Mesh3D in formato STL binary (80-byte header + triangle count + triangles).
    Più compatto dell'ASCII; accettato da tutti gli slicer e CAD.
    """
    facce = _triangoli_da_mesh(mesh)
    header = nome_oggetto.encode("ascii", errors="replace")[:80].ljust(80, b"\x00")
    buf = bytearray(header)
    buf += struct.pack("<I", len(facce))
    for f in facce:
        nx, ny, nz = _normalizza_normale(f)
        buf += struct.pack("<3f", nx, ny, nz)
        buf += struct.pack("<3f", f.a.x, f.a.y, f.a.z)
        buf += struct.pack("<3f", f.b.x, f.b.y, f.b.z)
        buf += struct.pack("<3f", f.c.x, f.c.y, f.c.z)
        buf += struct.pack("<H", 0)  # attribute byte count
    return bytes(buf)


def salva_stl_binary(mesh: Mesh3D,
                     percorso: str | Path,
                     nome_oggetto: str = "procardesign") -> Path:
    percorso = Path(percorso)
    percorso.write_bytes(esporta_stl_binary(mesh, nome_oggetto))
    return percorso


# ─────────────────────────────────────────────────────────────────────────────
# OBJ Wavefront
# ─────────────────────────────────────────────────────────────────────────────

def esporta_obj(mesh: Mesh3D,
                nome_oggetto: str = "procardesign") -> str:
    """
    Esporta Mesh3D in formato Wavefront OBJ minimale.
    Tutte le facce sono quadre (quads) per compatibilità CAD.
    """
    righe = [f"o {nome_oggetto}", "# vertices"]
    for v in mesh.vertici:
        righe.append(f"v {v.x:.6f} {v.y:.6f} {v.z:.6f}")
    righe.append("")
    righe.append("# faces (quads)")
    for f in mesh.facce:
        ia = mesh.vertici.index(f.a) + 1
        ib = mesh.vertici.index(f.b) + 1
        ic = mesh.vertici.index(f.c) + 1
        righe.append(f"f {ia} {ib} {ic}")
    righe.append("")
    return "\n".join(righe) + "\n"


def salva_obj(mesh: Mesh3D,
              percorso: str | Path,
              nome_oggetto: str = "procardesign") -> Path:
    percorso = Path(percorso)
    percorso.write_text(esporta_obj(mesh, nome_oggetto), encoding="utf-8")
    return percorso


# ─────────────────────────────────────────────────────────────────────────────
# GeoDef JSON (formato interno universale)
# ─────────────────────────────────────────────────────────────────────────────

def esporta_geodef(mesh: Mesh3D,
                   tipo: str = "custom",
                   position_mm: Optional[List[float]] = None,
                   rotation_deg: Optional[List[float]] = None,
                   material: str = "steel",
                   parameters: Optional[dict] = None) -> dict:
    """
    Avvolge una Mesh3D in un dizionario geo_def.json compatibile.
    Il triangolo rimane come vertici[9] per compatibilità universale.
    """
    return {
        "$schema": "pro.cardesign/geodef/v1",
        "metadata": {
            "units": "mm",
            "triangle_count": len(mesh.facce),
            "vertex_count":   len(mesh.vertici),
        },
        "mesh": {
            "type": tipo,
            "position_mm":   position_mm or [0.0, 0.0, 0.0],
            "rotation_deg":  rotation_deg or [0.0, 0.0, 0.0],
            "material":      material,
            "parameters":    parameters or {},
            "vertices": [[v.x, v.y, v.z] for v in mesh.vertici],
            "triangles":   [[mesh.vertici.index(f.a),
                              mesh.vertici.index(f.b),
                              mesh.vertici.index(f.c)] for f in mesh.facce],
        }
    }


def salva_geodef(mesh: Mesh3D,
                 percorso: str | Path,
                 tipo: str = "custom",
                 **kwargs) -> Path:
    percorso = Path(percorso)
    doc = esporta_geodef(mesh, tipo=tipo, **kwargs)
    percorso.write_text(json.dumps(doc, indent=2, ensure_ascii=False), encoding="utf-8")
    return percorso


# ─────────────────────────────────────────────────────────────────────────────
# Blender / CAD note (info per integrazione futura)
# ─────────────────────────────────────────────────────────────────────────────

def note_blender(mesh: Mesh3D) -> str:
    """Restituisce istruzioni per incollare la mesh in Blender via Python console."""
    verts = ",\n    ".join(f"({v.x:.4f}, {v.y:.4f}, {v.z:.4f})" for v in mesh.vertici)
    faces = ",\n    ".join(
        f"({mesh.vertici.index(f.a)}, {mesh.vertici.index(f.b)}, {mesh.vertici.index(f.c)})"
        for f in mesh.facce
    )
    return f"""# Incolla nella Python Console di Blender:
import bpy, bmesh
mesh_data = bpy.data.meshes.new("procardesign")
mesh_data.from_pydata(
    [{verts}],
    [],
    [{faces}]
)
obj = bpy.data.objects.new("procardesign_obj", mesh_data)
bpy.context.collection.objects.link(obj)
"""
