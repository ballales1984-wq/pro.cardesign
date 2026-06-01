# pro.cardesign 🚗

**Tool for digital car design** — A professional-grade parametric car design system with real-world measurements, brick-based geometry, and advanced material properties.

## 📋 Features

- 🧱 **Brick System** — Independent X/Y/Z sizing (not just cubes)
- 📏 **Real Measurements** — 1 Three.js unit = 1mm
- ⚙️ **Physics Engine** — Mass, center of mass, inertia calculations
- 🎨 **Material System** — 8 physical materials (steel, aluminum, titanium, etc.)
- 📦 **Export** — OBJ, STL mesh export with quality analysis
- 🔄 **Undo/Redo** — Full project history management
- 💾 **Save/Load** — JSON project persistence with scaling
- 🎯 **Interactive Scaling** — Drag-to-scale tool for real-time adjustment

## 🚀 Quick Start

### Prerequisites
- Node.js ≥16
- Python ≥3.9
- npm or yarn

### Installation

```bash
# Clone repository
git clone https://github.com/ballales1984-wq/pro.cardesign.git
cd pro.cardesign

# Install dependencies
npm install
pip install -r requirements.txt
```

### Development

```bash
# Start dev server (Vite + Electron)
npm run dev

# Run tests
npm run test:js          # JavaScript tests
python -m pytest         # Python tests
python -m pytest --cov   # Coverage report

# Get brick system info
python cli.py info
```

### Production

```bash
# Build
npm run build

# Package application
npm run package
```

## 📁 Project Structure

```
pro.cardesign/
├── core/                          # Python backend
│   ├── brick.py                  # Brick dataclass (position, size, volume)
│   ├── component.py              # ComponentDefinition/Instance/Library
│   ├── factory.py                # Factory functions
│   └── __init__.py
├── src/                           # JavaScript frontend
│   ├── core/
│   │   ├── brick-system.js       # Brick core with SCALE=1.0
│   │   ├── component-library.js  # UI component library
│   │   ├── scaling-tool.js       # Interactive drag scaling
│   │   └── stl-import.js         # STL parser + quality analyzer
│   ├── voxel-engine.js           # InstancedMesh, raycasting, undo/redo
│   ├── material-system.js        # 8 materials with physical properties
│   ├── module-system.js          # Functional module hierarchy
│   ├── physics-calc.js           # Mass, COM, inertia
│   ├── mesh-exporter.js          # OBJ/STL export
│   ├── ui.js                     # Toolbar, panels, DOM events
│   └── main.js                   # Entry point (Three.js)
├── tests/                         # Test suite
│   ├── test_coverage.py          # Python tests
│   └── test_coverage.js          # JavaScript tests
├── dist/                          # Build output (generated)
├── node_modules/                  # npm dependencies (generated)
├── .github/
│   └── workflows/                # CI/CD pipelines
├── AGENTS.md                      # AI assistant guidelines
├── README.md                      # This file
├── package.json                   # npm configuration
├── pyproject.toml                 # Python configuration
├── requirements.txt               # Python dependencies
└── .gitignore                     # Git ignore rules
```

## 🏗️ Architecture

### Python Backend (`core/`)
- **Brick System** — Real-world measurements (mm), independent dimensions
- **Components** — Parametric, reusable definitions and instances
- **Factory Functions** — `create_brick()`, `create_cube()`, `create_bar()`

### JavaScript Frontend (`src/`)
- **Three.js Rendering** — InstancedMesh for performance
- **Physics Engine** — Real-time mass, COM, inertia calculations
- **Material System** — 8 materials with physical properties (density, elasticity)
- **STL Import/Export** — Quality analysis (ovality, deviation)
- **Scaling Tool** — Interactive drag-to-scale with live dimensions
- **Undo/Redo** — Full project history

## 📊 Code Quality

- **Tests** — Every change requires passing tests
- **Coverage** — Python + JavaScript test coverage reports
- **Linting** — ESLint (JavaScript), black/flake8 (Python)
- **Git Hooks** — Pre-commit validation

## 📝 Conventions

| Aspect | Convention |
|--------|-------------|
| File names (JS) | `kebab-case` |
| File names (Python) | `snake_case` |
| Brick size | Array `[width, height, depth]` in mm |
| Voxel scale | Default `[1,1,1]`, modifiable |
| JSON format | `toJSON()` = data, `fromJSON()` = full restoration |
| Materials | Lowercase keys (`steel`, `aluminum`, etc.) |
| Constants | UPPERCASE_WITH_UNDERSCORES |

## 🎯 Development Priorities

1. **Brick System** — Size, position, overlap detection
2. **Scaling Tool** — Drag face, live dimensions
3. **Component Library** — Parametric wheels, tubes, custom parts
4. **Project Save/Load** — Scale included in JSON
5. **Import STL + Quality** — Ovality, deviation analysis

## 🤝 Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.

### Before Committing

```bash
# Run all tests
npm run test:js
python -m pytest

# Check code quality
npm run lint
```

### Git Workflow

```bash
git status
git diff
git commit -m "type(scope): clear description"
git push
```

### Do's ✅
- Write tests for every change
- Use meaningful commit messages
- Test both Python and JavaScript changes
- Document parametric components

### Don'ts ❌
- Use native alerts (use toast notifications)
- Add dependencies without discussion
- Modify `package.json` without consent
- Remove existing tests

## 📚 API Reference

### Python CLI

```bash
python cli.py info              # Brick system info
python cli.py create-brick      # Create new brick
python cli.py export-json       # Export project
```

### JavaScript Classes

- `VoxelEngine` — Core rendering + physics
- `BrickSystem` — Brick management (SCALE=1.0)
- `MaterialSystem` — Material library
- `PhysicsCalculator` — Mass, inertia, COM
- `STLImporter` — Parse + analyze STL files
- `ScalingTool` — Interactive scaling UI

## 📄 License

MIT License — See LICENSE file for details

## 👤 Author

**ballales1984-wq** — Digital car design tool creator

---

**Last Updated:** 2026-06-01  
**Status:** Active Development  
**Version:** 1.0.0-beta