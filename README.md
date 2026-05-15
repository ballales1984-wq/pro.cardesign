# Pro.Cardesign - Voxel CAD for Vehicle Design

> Sistema di progettazione voxel con misure reali (mm) per telai biciclette, auto leggere e strutture volumetriche.

## Stato Attuale

**v0.3.0** — Brick System + Componenti + Import STL completati. Build: `npm run build` → **16 moduli, 77.2 KB**.

## Features

- [x] **Brick System** — Mattoni con dimensioni reali in mm (es. 200×20×20mm barre)
- [x] **Scaling Tool** — Click & drag su facce per ridimensionare con dimensioni live
- [x] **Material Database** — 8 materiali con densità, Young's modulus, costo (kg/m³)
- [x] **Component Library** — 11 componenti parametrici predefiniti (ruote, tubi, sella, manubrio)
- [x] **Project Management** — Salva/carica JSON, export STL/OBJ
- [x] **Import STL + Quality Check** — Importa parti scannerizzate, analizza ovalità/deformazioni
- [ ] Aerodinamica (in sviluppo)

## Struttura Progetto

```
pro.cardesign/
├── core/                    # Python core
│   ├── brick.py            # Brick dataclass (mm, volume, overlap)
│   ├── component.py        # ComponentDefinition/Instance
│   ├── __init__.py
│   └── bike_demo.py        # Demo telaio bici
├── src/                     # JavaScript frontend (ES modules)
│   ├── voxel-engine.js     # Core rendering: InstancedMesh, raycasting
│   ├── material-system.js  # Database 8 materiali
│   ├── module-system.js    # Gerarchia moduli funzionali
│   ├── physics-calc.js     # Massa, COM, inerzia
│   ├── mesh-exporter.js    # OBJ + STL export
│   ├── ui.js               # Toolbar, pannelli, eventi
│   ├── main.js             # Entry point Three.js
│   └── core/               # Moduli aggiuntivi
│       ├── brick-system.js     # Brick frontend con SCALE=0.01
│       ├── component-library.js # Libreria componenti UI
│       ├── scaling-tool.js     # Interactive drag-to-scale
│       └── stl-import.js       # STL parser + QualityAnalyzer
├── voxel_editor.py         # Engine Python legacy (analisi)
├── physics_engine.py       # Stress/thermal analysis Python
├── cli.py                  # CLI minimale per test
├── tests/
│   ├── test_coverage.py    # 43 test Python
│   ├── test_coverage.js    # 4 test JS
│   └── COVERAGE_REPORT.md  # Report coverage
├── data/                   # Progetti salvati, componenti custom
├── dist/                   # Build produzione
├── index.html              # UI principale
├── requirements.txt        # Dipendenze Python
├── package.json            # Dipendenze Node.js
└── README.md
```

## Installazione

### Prerequisiti
- Node.js 14+ e npm
- Python 3.8+ (opzionale, per analisi lato server)

### Setup Rapido
```bash
# 1. Installa dipendenze Node
npm install

# 2. Installa dipendenze Python (opzionale)
pip install -r requirements.txt

# 3. Avvia development
npm run dev
```

### Build Produzione
```bash
npm run build   # Output in dist/
```

## Utilizzo

### Da linea di comando (Python)
```bash
# Info sul brick system
python cli.py info

# Crea brick di esempio
python cli.py create

# Calcola massa e centro di massa
python cli.py mass

# Lista componenti disponibili
python cli.py components
```

### Interfaccia grafica
```bash
npm run dev   # Avvia Vite + Electron
```

**Tasti rapidi:**
| Tasto | Azione |
|-------|--------|
| `A` | Aggiungi voxel |
| `V` | Seleziona |
| `R` | Rimuovi |
| `S` | Scalatura |
| `F` | Fill livello |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

## Testing

```bash
# Python — 43 test
python -m pytest tests/test_coverage.py -v

# Coverage Python
python -m pytest tests/test_coverage.py --cov=core --cov-report=html

# JavaScript — 4 test strutturali
node tests/test_coverage.js

# Report coverage completo
cat tests/COVERAGE_REPORT.md
```

**Status attuale:** 43/43 Python ✅ | 4/4 JavaScript ✅

## Roadmap

- [x] Fase 1: Brick System con misure reali
- [x] Fase 2: Interactive Scaling Tool
- [x] Fase 3: Component Library
- [x] Fase 4: Project Management
- [x] Fase 5: Import STL + Quality Check
- [ ] Fase 6: Aerodinamica visualization

## Tecnologie

| Layer | Tecnologia |
|-------|-----------|
| Frontend | Three.js + Vite + Electron |
| Backend | Python 3 + NumPy |
| Build | Vite + npm scripts |
| Test | pytest (Python) + Node assert (JS) |

## Licenza

MIT — Vedi `LICENSE`
```bash
npm install
```

### Development
```bash
npm run dev
```

This starts Vite dev server and Electron.

## Project Structure

```
pro.cardesign/
├── core/                    # Python core (future physics, analysis)
│   └── brick.py            # Brick dataclass with mm measurements
├── src/                     # JavaScript frontend
│   ├── voxel-engine.js     # Core Three.js rendering
│   ├── material-system.js  # Material database with properties
│   ├── module-system.js    # Hierarchical module organization
│   └── core/
│       └── brick-system.js # Brick management with real dimensions
├── voxel_editor.py         # Python voxel engine (legacy/analysis)
└── index.html              # Main UI
```

## Usage

1. Press `A` to add voxels/bricks
2. Press `V` to select and inspect
3. Press `R` to remove
4. Use mouse to navigate (orbit), scroll to zoom
5. Select materials from sidebar

## Development Roadmap

- [ ] Phase 1: Brick System with Real-World Measurements
- [ ] Phase 2: Interactive Scaling Tool
- [ ] Phase 3: Component Library (wheels, tubes)
- [ ] Phase 4: Project Management
- [ ] Phase 5: Import & Real Part Verification
- [ ] Phase 6: Aerodynamics Visualization