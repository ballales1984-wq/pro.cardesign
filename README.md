# Pro.Cardesign - Voxel CAD for Vehicle Design

> Voxel design system with real measurements (mm) for bicycle frames, lightweight vehicles, and volumetric structures.

## Current Status

**v0.7.0** — Sculpt Tool + Vertex Edit Tool + Sculpt Tool UI Integration. Build: `npm run build` → **31 modules, ~702 KB**.

## Features

- [x] **Brick System** — Bricks with real dimensions in mm (e.g. 200×20×20mm bars)
- [x] **Scaling Tool** — Click & drag on faces to resize with live dimensions (pixel-sensitive)
- [x] **Vertex Edit Tool** — Direct manipulation of vertices for precise shape editing
- [x] **Material Database** — 8 materials with density, Young's modulus, cost (kg/m³)
- [x] **Component Library** — 6 predefined parametric components (wheels, tubes, brick, saddle, handlebar)
- [x] **Project Management** — Save/load JSON, export STL/OBJ
- [x] **STL/OBJ Import + Quality Check** — Import scanned parts, analyze ovality/deformations with proper normal handling
- [ ] Aerodynamics (in development)

## Project Structure

```
pro.cardesign/
├── core/                    # Python core
│   ├── brick.py            # Brick dataclass (mm, volume, overlap)
│   ├── component.py        # ComponentDefinition/Instance/Library
│   ├── __init__.py
│   └── bike_demo.py        # Bike frame demo
├── src/                     # JavaScript frontend (ES modules)
│   ├── voxel-engine.js     # Core rendering: InstancedMesh, raycasting
│   ├── material-system.js  # Database of 8 materials
│   ├── module-system.js    # Functional module hierarchy
│   ├── physics-calc.js     # Mass, COM, inertia
│   ├── mesh-exporter.js    # OBJ + STL export
│   ├── ui.js               # Toolbar, panels, DOM events
│   ├── main.js             # Entry point Three.js
│   └── core/               # Additional modules
│       ├── brick-system.js     # Brick frontend with SCALE=1.0
│       ├── component-library.js # UI component library
│       ├── scaling-tool.js     # Interactive drag-to-scale tool
│       ├── stl-import.js       # STL parser + QualityAnalyzer
│       └── vertex-edit-tool.js # Vertex editing tool for precise mesh manipulation
├── voxel_editor.py         # Legacy Python voxel engine (analysis)
├── physics_engine.py       # Stress/thermal analysis Python
├── cli.py                  # Minimal CLI for testing
├── tests/
│   ├── test_coverage.py    # 43 Python tests
│   ├── test_coverage.js    # 4 JS tests
│   └── COVERAGE_REPORT.md  # Coverage report
├── data/                   # Saved projects, custom components
├── dist/                   # Production build
├── index.html              # Main UI
├── requirements.txt        # Python dependencies
├── package.json            # Node.js dependencies
└── README.md
```

## Installation

### Prerequisites

- Node.js 14+ and npm
- Python 3.8+ (optional, for server-side analysis)

### Quick Setup

```bash
# 1. Install Node dependencies
npm install

# 2. Install Python dependencies (optional)
pip install -r requirements.txt

# 3. Start development
npm run dev
```

### Production Build

```bash
npm run build   # Output in dist/
```

## Usage

### From Command Line (Python)

```bash
# Brick system info
python cli.py info

# Create example brick
python cli.py create

# Calculate mass and center of mass
python cli.py mass

# List available components
python cli.py components
```

### Graphical Interface

```bash
npm run dev   # Starts Vite + Electron
```

**Keyboard Shortcuts:**
| Key | Action |
|-----|--------|
| `A` | Add voxel |
| `V` | Select |
| `R` | Remove |
| `S` | Scale |
| `F` | Fill level |
| `Ctrl+Z` | Undo |
| `Ctrl+Y` | Redo |

## Testing

```bash
# Python — 43 tests
python -m pytest tests/test_coverage.py -v

# Python coverage
python -m pytest tests/test_coverage.py --cov=core --cov-report=html

# JavaScript — 4 structural tests
node tests/test_coverage.js

# Full coverage report
cat tests/COVERAGE_REPORT.md
```

**Current status:** 43/43 Python ✅ | 4/4 JavaScript ✅

## Roadmap

- [x] Phase 1: Brick System with real measurements
- [x] Phase 2: Interactive Scaling Tool
- [x] Phase 3: Component Library
- [x] Phase 4: Project Management
- [x] Phase 5: STL Import + Quality Check
- [x] Phase 6: Vertex Edit Tool
- [ ] Phase 7: Aerodynamics visualization

## Technologies

| Layer | Technology |
|-------|-----------|
| Frontend | Three.js + Vite + Electron |
| Backend | Python 3 + NumPy |
| Build | Vite + npm scripts |
| Test | pytest (Python) + Node assert (JS) |

## License

MIT — See `LICENSE`