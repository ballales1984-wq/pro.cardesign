# geometry_core — Mathematical / geometric engine
"""
Contenuti:
  __init__.py           — Punto3D, Triangolo, Mesh3D, CoordinateLocali
                           Bezier, spline, sweep, primitivi solidi,
                           geo_def_a_mesh, crea_geodef
  load_into_project.py  — Caricatore di geo_def.json → Brick + Component
"""

from . import geometry_core as _gm  # re-export per compatibilità

import numpy as np  # usato da load_into_project

__all__ = [
    "Punto3D", "Triangolo", "Mesh3D", "CoordinateLocali",
    "vettore_normale", "normalizza",
    "distanza3D",
    "spline_lineare", "bezier_cubica", "bezier_cubica_punti", "ellisse",
    "sweep_profile",
    "crea_cassa", "crea_cilindro", "crea_ruota",
    "crea_geodef", "geo_def_a_mesh",
    "load_geo_def",
]
