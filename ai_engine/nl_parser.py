"""
ai_engine — AI / natural-language parsing layer for pro.cardesign
Convert libero linguaggio in comandi di costruzione parametrica.
"""

from __future__ import annotations
import re
import logging

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════════
# Segmentazione di frasi semplici in token e comandi
# ═══════════════════════════════════════════════════════════════════════════════

_KEYWORDS_SHAPE = {
    "box", "parallelepipedo", "blocco", "blocco di",
    "cylinder", "cilindro",
    "wheel", "ruota", "cerchio",
    "spoiler", "alettone",
    "tube", "tubo",
}

_KEYWORDS_ACTION = {
    "create", "crea", "aggiungi", "put", "add",
    "make", "fai",
}

_KEYWORDS_MATERIAL = {
    "steel": "steel",
    "acciaio": "steel",
    "aluminum": "aluminum",
    "alluminio": "aluminum",
    "titanium": "titanium",
    "titanio": "titanium",
    "carbon": "carbon_fiber",
    "carbonio": "carbon_fiber",
    "fibra": "carbon_fiber",
    "rubber": "rubber",
    "gomma": "rubber",
}

_SYNONYMS_SHAPE = {
    "box":        "box",
    "parallelepipedo": "box",
    "blocco":     "box",
    "blocco di":  "box",
    "cylinder":   "cylinder",
    "cilindro":   "cylinder",
    "wheel":      "box_approximated_wheel",
    "ruota":      "box_approximated_wheel",
    "cerchio":    "box_approximated_wheel",
    "spoiler":    "spoiler",
    "alettone":   "spoiler",
    "tube":       "cylinder",
    "tubo":       "cylinder",
}


def _match_dimensions(text: str) -> list[float]:
    """Estrae le dimensioni 'LxWxH' o '100x50x25' dal testo."""
    # Cerca pattern: numero x numero x numero (case-insensitive)
    m = re.search(r"(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)",
                  text, re.IGNORECASE)
    if m:
        return [float(m.group(1)), float(m.group(2)), float(m.group(3))]
    return []


def _match_coords(text: str) -> tuple[float, float, float]:
    """Estrae coordinate posizionali, es: 'a 100,200,50' o 'in 50 60 70'."""
    m = re.search(r"(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)[,\s]+(\d+(?:\.\d+)?)",
                  text)
    if m:
        return float(m.group(1)), float(m.group(2)), float(m.group(3))
    return 0.0, 0.0, 0.0


def _match_material(text: str) -> str | None:
    """Riconosce il materiale menzionato."""
    low = text.lower()
    for key, mat in _KEYWORDS_MATERIAL.items():
        if key in low:
            return mat
    return None


def parse_nl_command(text: str) -> dict:
    """
    Converte una frase in linguaggio naturale in un comando parametrico.

    Esempi supportati:
      "crea box 100x50x25 a 0,0,0 in acciaio"
      "spoiler a 200,100,20 scala 300x80x30"
      "ruota 700c a 400,0,200"

    Restituisce:
      {
        "intent":   str,      # "create_primitive"
        "shape":    str,      # "box" | "cylinder" | ...
        "params":   dict,     # parametri geometrici
        "material": str,      # nome materiale
        "raw":      str,      # testo originale
      }
    """
    text = text.strip().lower()

    # 1. Riconosci forma
    shape = "box"  # default
    for syn, canonical in _SYNONYMS_SHAPE.items():
        if syn in text:
            shape = canonical
            break

    # 2. Estrai dimensioni
    dims = _match_dimensions(text)

    # 3. Estrai posizione
    pos = _match_coords(text)

    # 4. Estrai materiale
    mat = _match_material(text)

    # 5. Prova estrazione parametrica più ricca (es. "700c" → raggio 350mm)
    radius_mm: float | None = None
    m_700c = re.search(r"(\d+)\s*c", text)
    if m_700c:
        diameter_mm = float(m_700c.group(1))
        if shape == "box_approximated_wheel":
            radius_mm = diameter_mm / 2

    params: dict = {}
    if dims:
        params["scale_mm"] = dims
    if radius_mm is not None:
        params["radius_mm"] = radius_mm
        params["height_mm"] = dims[0] if dims else 30.0
        params["spoke_count"] = 24

    return {
        "intent":   "create_primitive",
        "shape":    shape,
        "position_mm": list(pos),
        "rotation_deg": [0, 0, 0],
        "params":   params,
        "material": mat or "steel",
        "raw":      text,
    }


def nl_to_geodef(text: str) -> dict:
    """
    Converte linguaggio naturale → geodef (formato interno universale).
    Wrapper di parse_nl_command che produce direttamente il dizionario geodef.
    """
    cmd = parse_nl_command(text)
    shape = cmd["shape"]
    scale = cmd["params"].get("scale_mm", [10, 10, 10])
    pos   = cmd["position_mm"]

    gd = {
        "type":          shape,
        "position_mm":   pos,
        "rotation_deg":  cmd["rotation_deg"],
        "scale_mm":      scale,
        "material":      cmd["material"],
        "parameters":    {k: v for k, v in cmd["params"].items()
                          if k not in ("scale_mm",)},
        "nl_raw":        cmd["raw"],
    }
    return gd
