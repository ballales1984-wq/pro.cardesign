"""
mesh_generator — Converte geometria interna in mesh triangolare esportabile
Supporta: voxel→mesh discreto, Bezier → polilinea, sweep → superficie.
"""

from __future__ import annotations
import math
from typing import List, Tuple

from geometry_core import (
    Punto3D, Triangolo, Mesh3D, bezier_cubica_punti, crea_cassa, crea_cilindro,
)


# ─────────────────────────────────────────────────────────────────────────────
# Voxel grid → Mesh3D (cubo per voxel, senza facce interne)
# ─────────────────────────────────────────────────────────────────────────────

def voxel_grid_a_mesh(voxels: list[dict]) -> Mesh3D:
    """
    Converte una lista di voxel {'x', 'y', 'z', 'material'} in Mesh3D.

    Ottimizzazione: ogni voxel crea solo le facce esposte (non crea facce
    verso voxel adiacenti).  Complessità O(N).
    """
    voxel_set = {(v["x"], v["y"], v["z"]) for v in voxels}
    mesh = Mesh3D()
    vert_map: dict[tuple, int] = {}

    def _get_or_add(p: Punto3D) -> int:
        key = (p.x, p.y, p.z)
        if key in vert_map:
            return vert_map[key]
        idx = mesh.aggiungi_vertice(p)
        vert_map[key] = idx
        return idx

    for v in voxels:
        x, y, z = v["x"], v["y"], v["z"]
        # 6 direzioni: controlla se il vicino esiste
        dirs = [
            ((1,  0,  0),  [(x+1,y,z+1),(x+1,y+1,z+1),(x+1,y+1,z),(x+1,y,z)] ),
            ((-1, 0,  0),  [(x,y,z+1),(x,y+1,z+1),(x,y+1,z),(x,y,z)] ),
            ((0,  1,  0),  [(x+1,y+1,z+1),(x,y+1,z+1),(x,y+1,z),(x+1,y+1,z)] ),
            ((0, -1,  0),  [(x+1,y,z+1),(x,y,z+1),(x,y,z),(x+1,y,z)] ),
            ((0,  0,  1),  [(x+1,y+1,z+1),(x,y+1,z+1),(x,y,z+1),(x+1,y,z+1)] ),
            ((0,  0, -1),  [(x+1,y+1,z),(x,y+1,z),(x,y,z),(x+1,y,z)] ),
        ]
        for (dx, dy, dz), quad_xyzw in dirs:
            if (x + dx, y + dy, z + dz) in voxel_set:
                continue  # faccia interna, skip
            verts = [Punto3D(*c) for c in quad_xyzw]
            ia = _get_or_add(verts[0])
            ib = _get_or_add(verts[1])
            ic = _get_or_add(verts[2])
            id_ = _get_or_add(verts[3])
            mesh.aggiungi_faccia(Triangolo(mesh.vertici[ia], mesh.vertici[ib], mesh.vertici[ic]))
            mesh.aggiungi_faccia(Triangolo(mesh.vertici[ia], mesh.vertici[ic], mesh.vertici[id_]))
    return mesh


# ─────────────────────────────────────────────────────────────────────────────
# Bézier surface (rivoluzione) → Mesh3D
# ─────────────────────────────────────────────────────────────────────────────

def rivoluzione_bezier(p0: Punto3D, p1: Punto3D, p2: Punto3D, p3: Punto3D,
                       asse: str = "z",
                       giri: int = 1,
                       segments_per_giri: int = 16) -> Mesh3D:
    """
    Genera una superficie di rivoluzione di una curva Bézier cubica.

    Args:
        p0…p3:         punti di controllo della curva Bézier nel piano (XY se asse Z).
        asse:          asse di rivoluzione: 'x', 'y' o 'z'.
        giri:          numero di giri completi (1 = 360°).
        segments_per_giri: campionamenti per giro.

    Returns:
        Mesh3D della superficie.
    """
    curva = bezier_cubica_punti(p0, p1, p2, p3, segments_per_giri)
    total_seg = int(segments_per_giri * giri)
    mesh = Mesh3D()

    def _sample(i: int) -> Punto3D:
        t = (curva[min(i, len(curva) - 1)])
        return curva[min(int(t * total_seg), len(curva) - 1)]

    vert_map: dict[tuple, int] = {}

    def _getvp(p: Punto3D) -> int:
        key = (round(p.x, 4), round(p.y, 4), round(p.z, 4))
        if key not in vert_map:
            vert_map[key] = mesh.aggiungi_vertice(p)
        return vert_map[key]

    for j in range(segments_per_giri):
        theta1 = 2 * math.pi * j / segments_per_giri
        theta2 = 2 * math.pi * (j + 1) / segments_per_giri
        cs1, sn1 = math.cos(theta1), math.sin(theta1)
        cs2, sn2 = math.cos(theta2), math.sin(theta2)

        for i in range(len(curva) - 1):
            if asse == "z":
                a1 = Punto3D(curva[i].x * cs1, curva[i].x * sn1, curva[i].z)
                b1 = Punto3D(curva[i + 1].x * cs1, curva[i + 1].x * sn1, curva[i + 1].z)
                b2 = Punto3D(curva[i + 1].x * cs2, curva[i + 1].x * sn2, curva[i + 1].z)
                a2 = Punto3D(curva[i].x * cs2, curva[i].x * sn2, curva[i].z)
            else:
                raise NotImplementedError(f"Asse '{asse}' non ancora supportato in rivoluzione")

            ia = _getvp(a1); ib = _getvp(b1)
            ic = _getvp(b2); idd = _getvp(a2)

            mesh.aggiungi_faccia(Triangolo(mesh.vertici[ia], mesh.vertici[ib], mesh.vertici[ic]))
            mesh.aggiungi_faccia(Triangolo(mesh.vertici[ia], mesh.vertici[ic], mesh.vertici[idd]))

    return mesh


# ─────────────────────────────────────────────────────────────────────────────
# Sweep di un contorno lungo un percorso polilineare → Mesh3D
# ─────────────────────────────────────────────────────────────────────────────

def sweep_mesh(contorno: List[Punto3D],
               percorso: List[Punto3D]) -> Mesh3D:
    """
    Genera una superficie di sweep: estrusione di `contorno` lungo `percorso`.

    Args:
        contorno: polilinea 2D nel piano locale XY.
        percorso: polilinea 3D che definisce l'asse centrale.

    Returns:
        Mesh3D della superficie risultante.
    """
    if len(contorno) < 2 or len(percorso) < 2:
        return Mesh3D()

    mesh = Mesh3D()
    vert_map: dict[tuple, int] = {}

    def _gvp(p: Punto3D) -> int:
        key = (round(p.x, 4), round(p.y, 4), round(p.z, 4))
        if key not in vert_map:
            vert_map[key] = mesh.aggiungi_vertice(p)
        return vert_map[key]

    n   = len(contorno)
    m   = len(percorso)

    for j in range(m - 1):
        pa, pb = percorso[j], percorso[j + 1]
        axis_vec = pb - pa
        axis_len = math.sqrt(axis_vec.x**2 + axis_vec.y**2 + axis_vec.z**2)
        if axis_len == 0:
            continue
        naxis = Punto3D(axis_vec.x / axis_len,
                        axis_vec.y / axis_len,
                        axis_vec.z / axis_len)

        # Costruisci il sistema di coordinate locale per il passo j
        ref = Punto3D(0, 1, 0) if abs(naxis.y) < 0.99 else Punto3D(1, 0, 0)
        tx  = Punto3D(ref.y * naxis.z - ref.z * naxis.y,
                      ref.z * naxis.x - ref.x * naxis.z,
                      ref.x * naxis.y - ref.y * naxis.x)
        tx  = Punto3D(tx.x / math.sqrt(tx.x**2 + tx.y**2 + tx.z**2),
                      tx.y / math.sqrt(tx.x**2 + tx.y**2 + tx.z**2),
                      tx.z / math.sqrt(tx.x**2 + tx.y**2 + tx.z**2))
        ty  = Punto3D(naxis.y * tx.z - naxis.z * tx.y,
                      naxis.z * tx.x - naxis.x * tx.z,
                      naxis.x * tx.y - naxis.y * tx.x)

        ring_a, ring_b = [], []
        for pi in contorno:
            local = Punto3D(pi.x * tx.x + pi.y * ty.x,
                            pi.x * tx.y + pi.y * ty.y,
                            pi.x * tx.z + pi.y * ty.z)
            ring_a.append(pa + local)
            ring_b.append(pb + local)

        for i in range(n):
            ia = i
            ib = (i + 1) % n
            v0 = _gvp(ring_a[ia]); v1 = _gvp(ring_b[ia])
            v2 = _gvp(ring_b[ib]); v3 = _gvp(ring_a[ib])
            mesh.aggiungi_faccia(Triangolo(mesh.vertici[v0], mesh.vertici[v1], mesh.vertici[v2]))
            mesh.aggiungi_faccia(Triangolo(mesh.vertici[v0], mesh.vertici[v2], mesh.vertici[v3]))

    return mesh
