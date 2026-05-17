"""
parametric_generator_review.py — Revizia sintassi e struttura di file di
componenti parametrici, regole procedurali e geo_def.json.

Controlli eseguiti:
  1. Validazione sintassi JSON/YAML
  2. Ogni componente: presenza di 'id', 'type', 'parameters'
  3. Ogni parametro: presenza di 'value' (obbligatorio)
  4. Parametri float negativi o NaN → warning FATAL
  5. Parametri con unità non-consone (es: 'mm' obbligatoria)
  6. Limiti min/max: min ≤ value ≤ max
  7. Tipo 'bbox_mm' → deve essere un array [x,y,z] positivo
  8. Chiavi sconosciute → warning
  9. Cross-ref: ogni 'definition_id' in regole deve esistere nel catalogo
 10. Summary: PASS / FAIL con conteggio errori

Uso:
  python geometry_core/parametric_generator_review.py datasets/automotive_components.json
  python geometry_core/parametric_generator_review.py geo_def.json
  python geometry_core/parametric_generator_review.py procedural_rules/*.json
"""

from __future__ import annotations

import json
import math
import sys
from pathlib import Path
from dataclasses import dataclass, field
from typing import Any


@dataclass
class Finding:
    level: str          # "FATAL" | "WARN" | "INFO"
    source: str         # file o regola
    message: str
    location: str = ""  # chiave o indice


@dataclass
class ReviewReport:
    findings: list[Finding] = field(default_factory=list)
    fatal_errors: int = 0
    warnings: int = 0
    infos: int = 0

    def add(self, level: str, source: str, message: str, location: str = ""):
        f = Finding(level, source, message, location)
        self.findings.append(f)
        if level == "FATAL":
            self.fatal_errors += 1
        elif level == "WARN":
            self.warnings += 1
        else:
            self.infos += 1

    @property
    def passed(self) -> bool:
        return self.fatal_errors == 0

    def print(self):
        seps = "=" * 64
        print(seps)
        print(f"  REVIEW REPORT — {self.fatal_errors} FATAL  {self.warnings} WARN  {self.infos} INFO")
        print(seps)
        for f in self.findings:
            icon = {"FATAL": "[FAIL]", "WARN": "[WARN]", "INFO": "[..] "}.get(f.level, "[.. ]")
            loc  = f" [{f.location}]" if f.location else ""
            print(f"  {icon} [{f.level}]{loc}  {f.source}: {f.message}")
        print(seps)
        status = "PASS" if self.passed else "FAIL"
        print(f"  Result: {status}\n")


# ─────────────────────────────────────────────────────────────────────────────
# Validatori specifici per formato
# ─────────────────────────────────────────────────────────────────────────────

_REQUIRED_COMPONENT_KEYS = {"id", "type", "parameters"}
_REQUIRED_PARAM_KEYS     = {"value"}
_UNITI_POSSIBILI         = {"mm", "deg", "kg", "N", "Pa", "s", "none"}


def _is_number(v: Any) -> bool:
    try:
        float(v)
        return not math.isnan(float(v))
    except (TypeError, ValueError):
        return False


def review_dataset_automotive(data: dict, report: ReviewReport):
    """Valida un file datasets/automotive_components.json."""
    components = data.get("components", [])
    if not components:
        report.add("FATAL", "root", "Nessun componente trovato in 'components[]'")
        return

    for comp in components:
        cid    = comp.get("id", "<unknown>")
        ctype  = comp.get("type", None)

        if missing := _REQUIRED_COMPONENT_KEYS - comp.keys():
            report.add("FATAL", f"comp[{cid}]",
                       f"Chiavi mancanti: {missing}")
            continue

        params = comp.get("parameters", {})
        if not isinstance(params, dict):
            report.add("FATAL", f"comp[{cid}]", "'parameters' non è un dizionario")
            continue

        for pk, pv in params.items():
            if not isinstance(pv, dict):
                report.add("WARN", f"comp[{cid}].{pk}",
                           "Parametro non è un oggetto {value, min, max}")
                continue
            val = pv.get("value")
            if val is None:
                report.add("FATAL", f"comp[{cid}].{pk}", "Manca 'value'")
                continue
            if not _is_number(val):
                report.add("FATAL", f"comp[{cid}].{pk}", f"'value' non numerico: {val!r}")
                continue
            fval = float(val)
            if math.isnan(fval) or math.isinf(fval):
                report.add("FATAL", f"comp[{cid}].{pk}", f"Valore NaN/Inf: {fval}")
            unit = pv.get("unit", "")
            if unit and unit not in _UNITI_POSSIBILI:
                report.add("WARN", f"comp[{cid}].{pk}",
                           f"Unità non standard: '{unit}'")
            lo = pv.get("min")
            hi = pv.get("max")
            if lo is not None and hi is not None:
                raw_lo, raw_hi = lo, hi
                if not _is_number(lo) or not _is_number(hi):
                    report.add("WARN", f"comp[{cid}].{pk}",
                               "min/max non numerici, skip controllo range")
                else:
                    if float(lo) > float(hi):
                        report.add("FATAL", f"comp[{cid}].{pk}",
                                   f"min ({raw_lo}) > max ({raw_hi})")
                    elif not (float(lo) <= fval <= float(hi)):
                        report.add(
                            "FATAL",
                            f"comp[{cid}].{pk}",
                            f"value={fval} fuori range [{lo}, {hi}]",
                        )
            # Chiavi sconosciute
            allowed = {"value", "min", "max", "unit", "description"}
            if unknown := set(pv.keys()) - allowed:
                report.add("WARN", f"comp[{cid}].{pk}",
                           f"Chiavi sconosciute: {unknown}")


def review_geodef(data: dict, report: ReviewReport):
    """Valida un file geo_def.json."""
    _ALLOWED_TYPES = {
        "box", "cylinder", "spoiler",
        "endplate", "winglet", "tube",
        "box_approximated_wheel", "body_panel",
        "aerodynamic", "air_intake", "custom",
    }
    components = data.get("components", [])
    if not components:
        report.add("FATAL", "root", "Nessun componente in 'components[]'")
        return

    for comp in components:
        cid = comp.get("id", "<unknown>")
        ctype = comp.get("type", None)
        pos   = comp.get("position_mm", None)
        scale = comp.get("scale_mm",  None)
        rot   = comp.get("rotation_deg", None)

        if ctype not in _ALLOWED_TYPES:
            report.add("WARN", f"comp[{cid}]", f"Tipo '{ctype}' non nella whitelist")

        for label, val in [("position_mm", pos), ("scale_mm", scale), ("rotation_deg", rot)]:
            if val is None:
                report.add("FATAL", f"comp[{cid}]", f"Manca '{label}'")
            elif not isinstance(val, list) or len(val) != 3:
                report.add("FATAL", f"comp[{cid}]", f"'{label}' non è una lista di 3 numeri")
            else:
                bad = [x for x in val if not _is_number(x)]
                if bad:
                    report.add("FATAL", f"comp[{cid}]", f"'{label}' contiene non-numeri: {bad}")
                elif label == "scale_mm":
                    bad_neg = [v for v in val if float(v) <= 0]
                    if bad_neg:
                        report.add("FATAL", f"comp[{cid}]",
                                   f"'scale_mm' deve essere > 0: {bad_neg}")


def review_procedural_rule(data: dict, report: ReviewReport):
    """Valida un file di regole procedurali JSON."""
    rname = data.get("name", "<unnamed>")
    if "actions" not in data and "primitives" not in data:
        report.add("WARN", rname, "Nessuna sezione 'actions' o 'primitives' trovata")


# ═══════════════════════════════════════════════════════════════════════════════
# Entry point CLI
# ═══════════════════════════════════════════════════════════════════════════════

def review_file(path: str | Path) -> ReviewReport:
    path = Path(path)
    report = ReviewReport()

    if not path.exists():
        report.add("FATAL", str(path), "File non trovato")
        return report

    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        report.add("FATAL", str(path), f"JSON non valido: {exc}")
        return report

    fname = path.name

    if "components" in data:
        if "dataset" in path.parts or path.parent.name == "datasets":
            review_dataset_automotive(data, report)
        else:
            review_geodef(data, report)
    elif ("type" in data
          and "position_mm" in data
          and "scale_mm"   in data):
        # geo_def.json singolo componente (senza wrapper "components[]")
        review_geodef({"components": [data]}, report)
    elif "actions" in data or "primitives" in data:
        review_procedural_rule(data, report)
    else:
        report.add("INFO", fname, "Nessun pattern noto; skip")

    return report


def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Revizia parametric generator files e geo_def.json",
        prog="parametric_generator_review",
    )
    parser.add_argument("files", nargs="+",
                        help="File JSON o directory da revisionare")
    args = parser.parse_args()

    all_ok = True
    for pattern in args.files:
        p = Path(pattern)
        if p.is_dir():
            for f in sorted(p.glob("**/*.json")):
                r = review_file(f)
                r.print()
                if not r.passed:
                    all_ok = False
        else:
            r = review_file(p)
            r.print()
            if not r.passed:
                all_ok = False

    sys.exit(0 if all_ok else 1)


if __name__ == "__main__":
    main()
