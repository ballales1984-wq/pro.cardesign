# Pro.Cardesign - Voxel CAD for Vehicle Design

> Voxel design system with real measurements (mm) for bicycle frames, lightweight vehicles, and volumetric structures.

## Current Status

**v0.7.0** — Sculpt Tool + Vertex Edit Tool + Sculpt Tool UI Integration. Build: `npm run build` → **22 modules, 594.6 KB**.

## Features

- [x] **Brick System** — Bricks with real dimensions in mm (e.g. 200×20×20mm bars)
- [x] **Scaling Tool** — Click & drag on faces to resize with live dimensions (pixel-sensitive)
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
│   ├── component.py        # ComponentDefinition/Instance
│   ├── __init__.py
│   └── bike_demo.py        # Bike frame demo
├── src/                     # JavaScript frontend (ES modules)
│   ├── voxel-engine.js     # Core rendering: InstancedMesh, raycasting
│   ├── material-system.js  # Database of 8 materials
│   ├── module-system.js    # Functional module hierarchy
│   ├── physics-calc.js     # Mass, COM, inertia
│   ├── mesh-exporter.js    # OBJ + STL export
│   ├── ui.js               # Toolbar, panels, events
│   ├── main.js             # Entry point Three.js
│   └── core/               # Additional modules
│       ├── brick-system.js     # Brick frontend with SCALE=0.01
│       ├── component-library.js # UI component library
│       ├── scaling-tool.js     # Interactive drag-to-scale
│       └── stl-import.js       # STL parser + QualityAnalyzer
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
- [ ] Phase 6: Aerodynamics visualization

## Technologies

| Layer | Technology |
|-------|-----------|
| Frontend | Three.js + Vite + Electron |
| Backend | Python 3 + NumPy |
| Build | Vite + npm scripts |
| Test | pytest (Python) + Node assert (JS) |

## License

MIT — See `LICENSE`
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