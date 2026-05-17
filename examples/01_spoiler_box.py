"""
examples — Esempi di utilizzo del motore geometrico
"""

# ── Esempio 1: Spoiler box approssimato ──────────────────────────────────────
#     Crea un box che rappresenta l'alettone principale
from geometry_core import crea_geodef, crea_cassa, Punto3D
import json

spoiler = crea_geodef(
    tipo="box",
    position_mm=(200, 100, 20),
    rotation_deg=(0, 0, -5),
    scale_mm=(300, 80, 30),
    parametri={"material": "carbon_fiber", "element_profile": "naca0012"},
)
print("GeoDef spoiler:", json.dumps(spoiler, indent=2))

# ── Esempio 2: Spoiler con mesh Bézier ───────────────────────────────────────
# from geometry_core import crea_ruota, Punto3D
# ruota = crea_ruota(Punto3D(400, 0, 200), raggio_esterno_mm=350, larghezza_mm=250)
# print(f"Volume ruota: {ruota.volume:.2f} mm³")

# ── Esempio 3: Sweep di un profilo NACA01 ────────────────────────────────────
# profilo = [Punto3D(x*10, y*10, 0) for x, y in [(0,0),(0.5,0.08),(1,0),(1,0),(0.5,-0.08),(0,0)]]
# asse    = [Punto3D(0,0,i*50) for i in range(20)]
# mesh_ex = sweep_mesh(profilo, asse)

# ── Esempio 4: Carica geo_def.json ───────────────────────────────────────────
# from geometry_core.load_into_project import load_geo_def
# bricks, comps = load_geo_def("geo_def.json", dry_run=True)
