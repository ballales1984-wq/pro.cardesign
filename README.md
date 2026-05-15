# Pro.Cardesign - Voxel CAD for Vehicle Design

A voxel-based CAD application for designing vehicles (bikes, cars, drones) with real-world measurements in millimeters.

## Features

- **Brick System**: Create solids with real mm dimensions (e.g., 200×20×20mm bars)
- **Interactive Scaling**: Click and drag faces to resize bricks with live dimension display
- **Material System**: Steel, Aluminum, Titanium, Carbon Fiber, Rubber with physical properties
- **Modular Organization**: Group bricks into functional modules (frame, body, etc.)
- **Physics Calculations**: Mass, center of mass, and volume calculations
- **Import/Export**: STL/OBJ support for 3D printing and manufacturing

## Getting Started

### Prerequisites
- [Node.js](https://nodejs.org/) (v14+)
- npm

### Installation
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