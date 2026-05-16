# pro.cardesign — AGENTS.md

Instructions for AI assistants working on this project.

## Philosophy

- Real measurements in mm (1 Three.js unit = 1mm)
- Brick with independent size[X,Y,Z] (not just identical cubes)
- Always separate geometry (Python) from rendering (Three.js)
- Functional modules: `core/` (Python), `src/` + `src/core/` (JS)
- Mandatory tests for every change

## Commands

```bash
npm run dev       # Starts Vite + Electron
npm run build     # Production build → dist/
npm run package   # Packages (if configured)
python cli.py info # Brick system info from CLI
```

## Tests

```bash
python -m pytest tests/test_coverage.py -v        # Python
python -m pytest tests/test_coverage.py --cov=core # Coverage
node tests/test_coverage.js                        # JavaScript
```

## Code Structure

### Python — `core/`
- `brick.py` — Brick dataclass (pos mm, size mm, volume)
- `component.py` — ComponentDefinition/Instance/Library
- Factory functions: `create_brick()`, `create_cube()`, `create_bar()`

### JavaScript — `src/`
- `voxel-engine.js` — InstancedMesh, raycasting, undo/redo, JSON
- `material-system.js` — 8 materials with physical properties
- `module-system.js` — Functional module hierarchy
- `physics-calc.js` — Mass, COM, inertia
- `mesh-exporter.js` — OBJ, STL export
- `ui.js` — Toolbar, panels, DOM events
- `main.js` — Entry point Three.js
- `src/core/brick-system.js` — Brick with SCALE=1.0
- `src/core/component-library.js` — UI component library
- `src/core/scaling-tool.js` — Interactive drag-to-scale tool
- `src/core/stl-import.js` — STL parser + QualityAnalyzer

## Conventions

- **File names**: kebab-case in JS, snake_case in Python
- **Brick size**: always array `[width, height, depth]` in mm
- **Voxel scale**: default `[1,1,1]`, modifiable with scaling tool
- **JSON save**: `toJSON()` = data structure, `fromJSON()` = full restoration
- **Materials**: lowercase keys (`steel`, `aluminum`, `titanium`)

## Development Priorities

1. **Brick System** — size, position, overlap
2. **Scaling Tool** — drag face, live dimensions
3. **Component Library** — parametric, wheels, tubes
4. **Project Save/Load** — scale included in JSON
5. **Import STL + Quality** — ovality, deviation, import

## Don't

- Don't use native alerts (use toast notification)
- Don't add dependencies without discussion
- Don't modify `package.json` without consent
- Don't remove existing tests

## Git

```bash
git status
git diff
git commit -m "msg"
```

Every change must pass tests before being committed.