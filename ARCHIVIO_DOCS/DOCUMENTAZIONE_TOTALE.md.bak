# VoxelCAD — Total Documentation

**Version:** 1.0  
**Date:** 2026-05-15  
**Repository:** github.com/ballales1984-wq/pro.cardesign  

---

## Index

1. [Project Overview](#1-project-overview)
2. [Philosophy and Key Concepts](#2-philosophy-and-key-concepts)
3. [System Architecture](#3-system-architecture)
4. [Software Stack](#4-software-stack)
5. [Developer Guide](#5-developer-guide)
6. [API Reference](#6-api-reference)
7. [User Guide](#7-user-guide)
8. [Development Plan](#8-development-plan)

---

## 1. Project Overview

**VoxelCAD** is a hybrid 3D modeling software that combines:

- **Voxel modeling**: Direct editing of 3D volumes
- **Physical properties**: Each voxel has material, density, temperature, friction, rigidity
- **Procedural geometry**: Rules instead of saved geometry
- **AI-assisted** (planned): Image recognition → procedural rules
- **Industrial export**: OBJ, STL, glTF

### What it does that other CADs don't

| Feature | VoxelCAD | Traditional CADs | Simple voxel editors |
|---------|----------|------------------|----------------------|
| Physical properties per voxel | ✅ | ❌ (only surface) | ❌ |
| Functional module hierarchy | ✅ | ✅ (feature tree) | ❌ |
| Procedural rules | 🔄 in development | ✅ | ❌ |
| AI from images | ⏳ planned | ❌ | ❌ |
| OBJ/STL export | ✅ | ✅ | ✅ |

---

## 2. Philosophy and Key Concepts

### 2.1 Intelligent Voxel

Each voxel is not just a color: it's a **material sample** with physical properties:

```javascript
{
  x: 0, y: 0, z: 0,      // grid coordinates
  material: 'steel',      // material name
  moduleId: 3,            // belongs to the "Frame" module
  // material-derived properties:
  // density = 7850 kg/m³
  // youngsModulus = 210 GPa
  // thermalConductivity = 50 W/(m·K)
  // roughness = 0.3
}
```

### 2.2 Materials as "recipes" of matter

The system doesn't save complete materials, but **parameters** that can be varied:

```
Material = {
  color,           → rendering
  density,         → mass, inertia
  youngModulus,    → rigidity, deformation
  poissonRatio,    → compression behavior
  thermalConductivity, → thermal simulation
  specificHeat,    → thermal energy accumulation
  meltingPoint,    → operational limits
  roughness,       → surface friction
  costPerKg,       → economic estimate
}
```

### 2.3 Functional Modules (Scene Graph)

Voxels are organized in a **module hierarchy** corresponding to real functional parts:

```
Vehicle
  ├── Frame
  │   ├── Front_Longeron
  │   └── Rear_Longeron
  ├── Bodywork
  │   ├── Hood
  │   ├── Front_Left_Fender
  │   └── Left_Door
  ├── Front_Left_Wheel [module]
  │   ├── Rim
  │   ├── Tire
  │   └── Brake_Disc
  └── Engine
      ├── Engine_Block
      ├── Cylinder_Head
      └── Camshaft
```

Each module has:
- VoxelKeys: list of voxels belonging to it
- Properties: tolerance, target weight, minimum rigidity, maximum stress
- Metadata: icon, color, visibility, edit lock

### 2.4 Object's Physical Signature

The final object is not the sum of voxels: it's the **emergent signature**:

```
Physical Signature = function of local properties → global behavior

Input:     { voxel_i.material, voxel_i.position, voxel_i.temperature }
           ↓
Calculation: { mass, CoM, inertia, material distribution }
             { stress map, temperature map }
             { exposed surface, aerodynamic coefficient }
Output:    Complete physical signature of the object
```

### 2.5 Role of Spheres in Matter Representation

Real matter is not a perfect cube grid. It's a collection of particles with empty spaces:

```
Voxel (cube)          Simplified representation
    ┌───┐                  🎱🎱🎱 ← spheres
    │   │
    └───┘

Sphere radius = voxelSize × fillCoefficient

fillCoefficient = 0.5  →  Porosity ~50% (foam)
fillCoefficient = 0.707→  Standard density (spheres touch at edges)
fillCoefficient = 1.0  →  Fully compact material
fillCoefficient = 0.3  →  Aerogel / rarefied materials
```

Spheres are:
- **Default export** for external CFD/FEM simulations
- **Base for simulations** (spheres = particles, empty spaces = voids or air)

### 2.6 Tetrahedra for FEM Simulations

Each voxel/cell is subdivided into tetrahedra for stress simulations:

```
Voxel 1×1×1 (8 nodes)
        4──────────7
       /|         /|
      0──────────3 |
     / |        /  |
    5──────────6   |
    |  |       |   |
    |  2───────┘   |
    | /               |
    |/               |
    1───────────────┘

MacNeal subdivision:
  Tetrahedron A: nodes 0,1,2,4
  Tetrahedron B: nodes 0,2,3,4
  Tetrahedron C: nodes 0,3,7,4
  Tetrahedron D: nodes 0,7,6,4
  Tetrahedron E: nodes 0,6,5,4
```

Each tetrahedron inherits the material properties of the voxel and calculates:
- **Local stiffness matrix K** (depends on E, ν and geometry)
- **Stress tensor σ** (from applied forces)
- **Strain ε** (node displacements)

---

## 3. System Architecture

### 3.1 Project Folder Structure

```
pro.cardesign/
├── src/                          # Application source code
│   ├── main.js                   # Entry point (init scene, camera, UI)
│   ├── voxel-engine.js           # Central voxel engine
│   ├── material-system.js        # Materials database
│   ├── module-system.js          # Module hierarchy
│   ├── physics-calc.js           # Physical calculations
│   ├── mesh-exporter.js          # OBJ/STL/glTF export
│   ├── ui.js                     # UI panels and toolbar
│   ├── procedural-engine.js      # [FUTURE] Procedural rules
│   ├── sphere-system.js          # [FUTURE] Spherical representation
│   ├── tetrahedral-mesh.js       # [FUTURE] Tetrahedral subdivision
│   ├── stress-analysis.js        # [FUTURE] FEM / stress analysis
│   └── thermal-sim.js            # [FUTURE] Thermal simulation
├── dist/                         # Production build
├── public/                       # Static assets
├── styles/                       # CSS stylesheets
├── node_modules/                 # Dependencies
├── index.html                    # Entry HTML
├── main.js (root)                # Main Electron process
├── vite.config.js                # Vite configuration
├── package.json                  # Project metadata and dependencies
├── DEVELOPMENT_PLAN.md           # Development plan (current state)
├── PIANO_SVILUPPO_COMPLETO.md    # Complete plan (this file)
├── DOCUMENTAZIONE_TOTALE.md      # This file
└── ARCHITETTURA_VOXEL_PROCEDURALE_AI.md  # General AI architecture
```

### 3.2 Dependencies

```
pro.cardesign/
├── three@^0.167.0              # 3D Engine
├── vite@^5.4.0                 # Build tool
├── concurrently@^8.0.0          # Start Vite + Electron together
├── wait-on@^7.2.0              # Wait for Vite to be ready
└── electron@^42.1.0            # Desktop wrapper (optional)
```

---

## 4. Software Stack

### 4.1 Current Stack

| Layer | Library | Version | Role |
|-------|---------|---------|------|
| 3D Engine | Three.js | r167 | WebGL rendering, scene graph, geometries |
| Build | Vite | 5.x | HMR, bundle, dev server |
| Bundle output | ES Modules | — | Native browser-supported imports |
| Export mesh | Custom writer | — | OBJ ASCII, binary/ASCII STL |

### 4.2 Planned Stack

| Layer | Library | Reason for choice |
|-------|---------|-------------------|
| AI Vision | PyTorch + ONNX.js | Depth estimation, segmentation, VLM |
| Segmentation | SAM (Meta) | Object recognition without training |
| Depth | MiDaS / ZoeDepth | Depth from single image |
| Mesh processing | Open3D / Trimesh | Mesh + voxel grid processing |
| FEM / Physics | Custom + Numeric.js | Thermal/structural stress analysis |
| GPU Compute | WebGPU shaders | Voxel update, marching cubes, simulations |
| Advanced Rendering | Three.js + Nanite-like | Adaptive LOD, GPU instances |

---

## 5. Developer Guide

### 5.1 Environment Setup

```powershell
# Prerequisites
node --version  # v18+ recommended (v24 OK)
npm --version

# Install dependencies
npm install

# Start development (frontend Vite only, always works)
npm run dev
# → http://localhost:5176

# Production build
npm run build
# → dist/index.html + dist/assets/

# Vite only (without Electron)
npx vite --port 5176 --strictPort
```

### 5.2 Structure of a New Module

```javascript
// src/nuovo-modulo.js
export class NuovoModulo {
  constructor(dependency1, dependency2) {
    this.dependency1 = dependency1;
    this.dependency2 = dependency2;
  }

  // Main method
  doSomething(param) {
    // ...
  }
}

// In src/main.js, import and instantiate:
import { NuovoModulo } from './nuovo-modulo.js';
const nuovo = new NuovoModulo(engine, materialDB);
```

### 5.3 Adding a Material

In `src/material-system.js`, in the `_defaults()`:

```javascript
{
  name: 'mio_materiale',
  label: 'My Material',
  color: 0xFF5733,
  density: 4500,                // kg/m³
  youngsModulus: 50e9,          // Pa (elastic modulus)
  poissonRatio: 0.3,            // dimensionless
  tensileStrength: 250e6,       // Pa
  thermalConductivity: 100,     // W/(m·K)
  specificHeat: 500,            // J/(kg·K)
  meltingPoint: 1200,           // °C
  costPerKg: 4.5,               // €/kg
  recyclable: true,
  roughness: 0.4,               // 0 = mirror-like, 1 = rough
  metalness: 0.8,               // 0 = dielectric, 1 = metallic
}
```

### 5.4 Adding a Physical Property to Voxel

Modify `src/voxel-engine.js` in the `VoxelEngine` constructor and `addVoxel()`:

```javascript
// In the constructor, when creating new voxel data:
const voxelData = {
  x, y, z,
  material: this.activeMaterial,
  moduleId: this.activeModule?.id || null,
  density: mat.density,        // ← new property
  temperature: 25,              // ← new property (°C)
  stress: 0,                    // ← from simulation
};

// Save it in the grid:
this.voxels.set(key, voxelData);
```

### 5.5 Raycasting Debugging

The raycaster uses `Raycaster.intersectObject()` with the criterion "first voxels, then ground plane":

```
Ray (from camera to mouse)
    ↓
Intersect voxel InstancedMesh → hit.instanceId → voxelKey → XYZ coordinates
    ↓
If no voxel → Intersect ground plane → XZ coordinates on Y=0
```

To debug: open browser console (F12) and type:
```javascript
// Show all voxels in scene
window.voxelEngine.voxels.forEach((v, k) => console.log(k, v));

// Force add voxel at (0,0,0)
window.voxelEngine.addVoxel({x:0,y:0,z:0}, 'steel', null);
```

### 5.6 Mesh Export

```javascript
// In browser console:
const exporter = window.voxelEngine.meshExporter;
const geometry = exporter.voxelToGeometry(window.voxelEngine.voxels, 1.0, false);
const objString = exporter.exportOBJ(geometry);
// Download file
const blob = new Blob([objString], {type: 'text/plain'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = 'mesh.obj'; a.click();
```

---

## 6. API Reference

### `VoxelEngine` (`src/voxel-engine.js`)

```javascript
// Constructor
new VoxelEngine(scene, materialDB, moduleSystem, camera, renderer, controls)

// Reading
getVoxelAt(x, y, z)        → {x, y, z, material, moduleId} | null
getAllVoxels()              → Array<voxelData>
getVoxelCount()             → number
getSelectedVoxel()          → {x, y, z} | null

// Writing
addVoxel(pos, materialName, moduleId) → void
removeVoxel(x, y, z)                 → void
selectVoxel(x, y, z)                → void
clearAll()                           → void

// Tools
setTool('add' | 'remove' | 'select' | 'fill')
setMaterial(name)

// Saving / Loading
toJSON()  → object
fromJSON(data) → void

// Export
getMeshExporter() → MeshExporter
```

### `MaterialSystem` (`src/material-system.js`)

```javascript
new MaterialSystem()

get(name)               → material | null
getAll()                → Array<material>
getDensity(name)        → number (kg/m³)
getVoxelMass(voxel)     → number
getVoxelWeight(voxel)   → number
add(material)           → boolean
remove(name)            → boolean
count()                 → number
```

### `ModuleSystem` (`src/module-system.js`)

```javascript
new ModuleSystem(materialDB)

createRoot(name)               → moduleId
createModule(name, parentId)   → moduleId | null
removeModule(moduleId)         → boolean
get(moduleId)                  → Module | null
getAll()                       → Array<Module>
getChildren(moduleId)          → Array<Module>
getTree(moduleId)              → { id, name, voxelCount, children: [...] }
getVoxelsForModule(id, engine) → Array<voxelData>
assignVoxelToModule(key, moduleId) → boolean
unassignVoxel(key, moduleId)   → boolean

getTree()    → complete hierarchical tree (root = Vehicle)
toJSON()     → serializable object
fromJSON(data) → reconstructs from object
```

### `PhysicsCalc` (`src/physics-calc.js`)

```javascript
new PhysicsCalc(materialDB, moduleSystem)

voxelMass(voxel, volume)       → number
voxelWeight(voxel)             → number
calculateAllVoxels(voxels)     → {
  voxelCount, totalMass, totalVolume, density,
  centerOfMass: {x,y,z},
  inertia: {xx, yy, zz},
  materialDistribution: { [name]: {count, mass} },
  weight
}
calculateModule(moduleId, engine) → { ..., moduleName }
calculateVehicle(engine)         → { ... }

// Static utilities
PhysicsCalc.densityFromMassVolume(mass, volume) → number
PhysicsCalc.massFromDensityVolume(density, volume) → number
PhysicsCalc.volumeFromMassDensity(mass, density) → number

suggestMaterial(minStrength, maxWeight) → Array<{material, label, density, strength, costPerKg}>
thermalAnalysis(voxels, ambientTemp, heatSourceTemp) → {
  avgThermalConductivity,
  avgSpecificHeat,
  maxTemperature,
  heatDissipationRate
}
```

### `MeshExporter` (`src/mesh-exporter.js`)

```javascript
new MeshExporter()

voxelToGeometry(voxels, voxelSize, smooth)  → THREE.BufferGeometry
_exportOBJ(geometry, voxels, voxelSize)       → string (OBJ ASCII format)
_exportSTLASCII(geometry)                     → string (STL ASCII format)
_exportSTLBinary(geometry)                    → Blob (binary STL format)
```

### `ProceduralEngine` — Planned API (Phase 4)

```javascript
// src/procedural-engine.js [FUTURE]

new ProceduralEngine(voxelEngine)

// Register a procedural rule
registerRule(name, ruleObject) → void

// Execute a rule → returns generated voxels
execute(ruleName, params) → Array<voxelData>

// Primitive rules
primitives.LINEA({ length, axis: 'x'|'y'|'z', offset })
primitives.CUBO({ x, y, z, width, height, depth })
primitives.ESTRUSIONE({ profile, height })
primitives.SIMMETRIA({ axis, axes })
primitives.RIVOLUZIONE({ profile, radii })
```

---

## 7. User Guide

### 7.1 Startup

```powershell
# Method 1: Vite in browser (always works)
npm run dev
# → Open http://localhost:5176 in browser

# Method 2: Electron desktop
# Currently requires Electron fix on Windows — see Known Issues
npm start
```

### 7.2 Basic Controls

| Action | Control |
|--------|---------|
| Rotate camera | Left mouse button + drag |
| Zoom | Mouse wheel |
| Pan camera | Right mouse button + drag |
| Add voxel | Left click on existing voxel (tool A) |
| Remove voxel | Right click on voxel (tool R) |
| Select voxel | Left click (tool V) |
| Fill level | Left click on a face (tool F) |

### 7.3 Tools (top toolbar)

| Icon | Tool | Description |
|------|------|-------------|
| **V** | Select | Select a voxel and show properties |
| **A** | Add | Place a new voxel adjacent to clicked voxel |
| **R** | Remove | Delete the clicked voxel |
| **F** | Fill | Fill an entire Y level with current material |

### 7.4 Material Selection

Left side panel: *Material Palette*

Each material shown with:
- Name and color
- Density (kg/m³)
- Young's Modulus (GPa)
- Thermal conductivity (W/(m·K))
- Roughness

Click a material to make it active. The next voxel you place will use this material.

### 7.5 Selected Voxel Properties

When you select a voxel (tool V), the *Properties* panel shows:
- Coordinates (x, y, z)
- Current material
- Belonging module

### 7.6 Model Physics

**Calculate Physics** button in the *Physics* panel:
- Total mass
- Total volume
- Average density
- Center of mass (x, y, z)
- Inertia (Ixx, Iyy, Izz)
- Material distribution (voxel count per material)

### 7.7 Export

**Export Mesh (OBJ/STL)** button:
- Choose format: OBJ ASCII, STL ASCII, STL Binary
- File downloads automatically

### 7.8 Project Save

Toolbar button:
- **Save Project** → saves `progetto.json` (all voxels + modules + settings)
- **Load Project** → loads from `progetto.json`
- **Reset** → clears the scene

---

## 8. Development Plan

See [PIANO_SVILUPPO_COMPLETO.md](./PIANO_SVILUPPO_COMPLETO.md) for the detailed phase-by-phase plan.

### Brief Summary

| Phase | Name | Status |
|-------|------|--------|
| 1 | Base Voxel Engine | ✅ Completed |
| 2 | 3D Editor | ✅ Completed |
| 3 | Performance Optimization | 🔄 In progress (chunk, marching cubes) |
| 4 | Procedural Engine | ⏳ To start |
| 5 | Matter Representation (spheres, tetrahedra) | ⏳ New — high priority |
| 6 | Physical Simulations | ⏳ To start |
| 7 | AI Engine | ⏳ To start |
| 8 | Video Reconstruction | ⏳ To start |

### Immediate Next Milestone

```
Phase 3: Chunk System + Marching Cubes complete
  → Goal: smooth scene at 60fps with 50,000+ voxels
  → Files: voxel-engine.js (refactor), mesh-exporter.js (MC complete)
```

---

*Main document of the VoxelCAD project*  
*See also: [PIANO_SVILUPPO_COMPLETO.md](./PIANO_SVILUPPO_COMPLETO.md) · [ARCHITETTURA_VOXEL_PROCEDURALE_AI.md](./ARCHITETTURA_VOXEL_PROCEDURALE_AI.md)*