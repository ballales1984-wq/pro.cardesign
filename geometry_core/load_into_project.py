"""
load_into_project.py
----------------------
Carica un file geo_def.json nel progetto, traducendo ogni componente
nel modello dati interno di pro.cardesign (Brick + ComponentInstance).

Uso:
  python geometry_core/load_into_project.py geo_def.json [--dry-run]

  python cli.py load geo_def.json
"""

from __future__ import annotations

import argparse
import json
import sys
import os
from pathlib import Path

# Aggiungi root al path per importare core/
_ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(_ROOT))

from core.brick import Brick, create_brick, create_bar, create_wheel_tire, next_brick_id
from core.component import ComponentDefinition, ComponentInstance, ComponentLibrary


# ═══════════════════════════════════════════════════════════════════════════════
# Mapping tipo geodef → Brick / ComponentInstance
# ═══════════════════════════════════════════════════════════════════════════════

def _geodef_box_to_brick(gd: dict) -> Brick:
    px, py, pz = gd["position_mm"]
    sx, sy, sz = gd["scale_mm"]
    return create_brick(
        id=next_brick_id(),
        name=gd.get("id", "unnamed"),
        size_mm=[sx, sy, sz],
        position_mm=[px, py, pz],
        material=gd.get("material", "steel"),
    )


def _geodef_cylinder_to_brick(gd: dict) -> Brick:
    """Approssima un cilindro con un parallelepipedo equivalent-cube."""
    px, py, pz = gd["position_mm"]
    params   = gd.get("parameters", {})
    diametro = params.get("diameter_mm", gd["scale_mm"][0])
    altezza  = params.get("height_mm",   gd["scale_mm"][2])
    return create_brick(
        id=next_brick_id(),
        name=gd.get("id", "cylinder"),
        size_mm=[diametro, diametro, altezza],
        position_mm=[px, py, pz],
        material=gd.get("material", "steel"),
    )


def _geodef_wheel_to_brick(gd: dict) -> Brick:
    px, py, pz = gd["position_mm"]
    sx, sy, sz = gd["scale_mm"]
    larghezza = sx
    diametro  = max(sy, sz)
    return create_wheel_tire(
        id=next_brick_id(),
        name=gd.get("id", "wheel"),
        radius_mm=diametro / 2,
        width_mm=larghezza,
        position_mm=[px, py, pz],
    )


_GEO_DEF_HANDLERS = {
    "box":                      _geodef_box_to_brick,
    "cylinder":                 _geodef_cylinder_to_brick,
    "box_approximated_wheel":   _geodef_wheel_to_brick,
}


def _geodef_to_component_def(gd: dict) -> ComponentDefinition:
    """Converte un geodef in una ComponentDefinition per la libreria."""
    tipo = gd.get("type", "custom")
    params = gd.get("parameters", {})
    return ComponentDefinition(
        id=-1,   # assegnato dal loader
        name=gd.get("id", tipo),
        type=tipo,
        category="imported",
        parameters={k: v for k, v in params.items() if isinstance(v, (int, float))},
        default_voxels=[],
        description=gd.get("metadata", {}).get("description", ""),
        color="#888888",
    )


# ═══════════════════════════════════════════════════════════════════════════════
# Caricamento
# ═══════════════════════════════════════════════════════════════════════════════

def load_geo_def(filepath: str | Path,
                 library: ComponentLibrary | None = None,
                 dry_run: bool = False,
                 ) -> tuple[list[Brick], list[ComponentInstance]]:
    """
    Carica un file geo_def.json e restituisce (lista_brick, lista_componenti).

    Args:
        filepath:   percorso al file geo_def.json.
        library:    ComponentLibrary esistente (se None ne crea una nuova).
        dry_run:    se True non crea brick ma solo stampa il piano.

    Returns:
        (bricks, component_instances)
    """
    filepath = Path(filepath)
    if not filepath.exists():
        raise FileNotFoundError(f"File non trovato: {filepath}")

    with open(filepath, "r", encoding="utf-8") as fh:
        geodef = json.load(fh)

    if library is None:
        library = ComponentLibrary()

    bricks:      list[Brick]       = []
    components:  list[ComponentInstance] = []

    for comp in geodef.get("components", []):
        ctype = comp.get("type", "box")
        handler = _GEO_DEF_HANDLERS.get(ctype)

        if handler:
            brick = handler(comp)
            if not dry_run:
                bricks.append(brick)
            print(f"  [BRICK]  {brick.name:30s} | "
                  f"{brick.size[0]:.0f}×{brick.size[1]:.0f}×{brick.size[2]:.0f} mm | "
                  f"pos={brick.position} | {brick.material}")
        else:
            # Tipo non nativo → registra come componente parametrico
            cdef = _geodef_to_component_def(comp)
            cdef.id = next_brick_id()   # ID temporaneo coerente
            library.definitions[cdef.id] = cdef
            px, py, pz = comp.get("position_mm", [0, 0, 0])
            inst = ComponentInstance(
                id=next_brick_id(),
                definition_id=cdef.id,
                name=cdef.name,
                position=np.array([px, py, pz], dtype=float),
                rotation=np.array(comp.get("rotation_deg", [0, 0, 0]), dtype=float),
                parameter_overrides=comp.get("parameters", {}),
                material_override=comp.get("material"),
            )
            if not dry_run:
                components.append(inst)
            print(f"  [COMP]   {cdef.name:30s} | tipo={ctype} | pos=({px},{py},{pz})")

    print(f"\nTotale brick creati:       {len(bricks)}")
    print(f"Totale componenti importati: {len(components)}")
    return bricks, components


# ═══════════════════════════════════════════════════════════════════════════════
# CLI
# ═══════════════════════════════════════════════════════════════════════════════

if __name__ == "__main__":
    import numpy as np  # import locale per il modulo CLI
    import argparse

    parser = argparse.ArgumentParser(description="Carica geo_def.json nel progetto")
    parser.add_argument("file", help="Percorso al file geo_def.json")
    parser.add_argument("--dry-run", action="store_true",
                        help="Solo anteprima, non crea brick")
    args = parser.parse_args()

    bricks, comps = load_geo_def(args.file, dry_run=args.dry_run)
