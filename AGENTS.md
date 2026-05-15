# pro.cardesign — AGENTS.md

Istruzioni per assistenti AI che lavorano su questo progetto.

## Filosofia

- Misure reali in mm (1 unità Three.js = 1mm, viewport SCALE=0.01)
- Brick con size[X,Y,Z] indipendente (non solo cubi identici)
- Separa sempre geometria (Python) da rendering (Three.js)
- Moduli funzionali: `core/` (Python), `src/` + `src/core/` (JS)
- Test obbligatori per ogni modifica

## Comandi

```bash
npm run dev       # Avvia Vite + Electron
npm run build     # Build produzione → dist/
npm run package   # Pacchettizza (se configurato)
python cli.py info # Info brick system da CLI
```

## Test

```bash
python -m pytest tests/test_coverage.py -v        # Python
python -m pytest tests/test_coverage.py --cov=core # Coverage
node tests/test_coverage.js                        # JavaScript
```

## Struttura Codice

### Python — `core/`
- `brick.py` — Brick dataclass (pos mm, size mm, volume)
- `component.py` — ComponentDefinition/Instance/Library
- Funzioni factory: `create_brick()`, `create_cube()`, `create_bar()`

### JavaScript — `src/`
- `voxel-engine.js` — InstancedMesh, raycasting, undo/redo, JSON
- `material-system.js` — 8 materiali con proprietà fisiche
- `module-system.js` — Gerarchia moduli funzionali
- `physics-calc.js` — Massa, COM, inerzia
- `mesh-exporter.js` — OBJ, STL export
- `ui.js` — Toolbar, pannelli, eventi DOM
- `main.js` — Entry point Three.js
- `src/core/brick-system.js` — Brick con SCALE=0.01
- `src/core/component-library.js` — Libreria componenti UI
- `src/core/scaling-tool.js` — Drag-to-scale interattivo
- `src/core/stl-import.js` — Parser STL + QualityAnalyzer

## Convenzioni

- **Nomi file**: kebab-case in JS, snake_case in Python
- **Brick size**: sempre array `[width, height, depth]` in mm
- **Voxel scale**: default `[1,1,1]`, modificabile con scaling tool
- **JSON save**: `toJSON()` = struttura dati, `fromJSON()` = ripristino completo
- **Materiali**: chiavi in minuscolo (`steel`, `aluminum`, `titanium`)

## Priorità Sviluppo

1. **Brick System** — dimensione, posizione, overlap
2. **Scaling Tool** — drag faccia, dimensioni live
3. **Component Library** —parametrico, ruote, tubi
4. **Project Save/Load** — scale incluse nel JSON
5. **Import STL + Quality** — ovalità, deviazione, import

## Non Fare

- Non usare alert() nativi (usa toast notification)
- Non aggiungere dipendenze senza discuterne
- Non modificare `package.json` senza consentimento
- Non rimuovere test esistenti

## Git

```bash
git status
git diff
git commit -m "msg"
```

Ogni modifica deve passare i test prima di essere commessa.