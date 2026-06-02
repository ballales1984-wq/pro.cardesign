# VoxelCAD — Documentazione Unificata

**Versione:** 1.0  
**Data:** 2026-05-29  
**Repository:** github.com/ballales1984-wq/pro.cardesign

---

## Indice

1. [Overview del Progetto](#1-overview-del-progetto)
2. [Filosofia e Concetti Chiave](#2-filosofia-e-concetti-chiave)
3. [Architettura del Sistema](#3-architettura-del-sistema)
4. [Stato delle Funzionalità](#4-stato-delle-funzionalità)
5. [Stack Tecnologico](#5-stack-tecnologico)
6. [API Reference](#6-api-reference)
7. [Guida Sviluppatore](#7-guida-sviluppatore)
8. [Roadmap](#8-roadmap)

---

## 1. Overview del Progetto

**VoxelCAD** è un software di modellazione 3D ibrido per design veicoli che combina:

- **Voxel modeling**: editing diretto di volumi 3D
- **Proprietà fisiche**: materiale, densità, temperatura, attrito, rigidità per ogni voxel
- **Geometria procedurale**: regole invece di geometria salvata
- **AI-assisted** (pianificata): riconoscimento immagini → regole procedurali
- **Export industriale**: OBJ, STL, glTF

### Caratteristiche distintive

| Feature | VoxelCAD | CAD Tradizionali | Editor Voxel Semplici |
|---------|----------|-----------------|----------------------|
| Proprietà fisiche per voxel | ✅ | ❌ | ❌ |
| Gerarchia moduli funzionali | ✅ | ✅ | ❌ |
| Regole procedurali | ✅ | ✅ | ❌ |
| AI da immagini | ⏳ | ❌ | ❌ |
| Export OBJ/STL | ✅ | ✅ | ✅ |

---

## 2. Filosofia e Concetti Chiave

### 2.1 Voxel Intelligente

Ogni voxel è un **campione di materiale** con proprietà fisiche:

```javascript
{
  x: 0, y: 0, z: 0,      // coordinate griglia
  material: 'steel',
  module: 3,               // appartiene al modulo "Frame"
  density: 7850,           // kg/m³
  temperature: 293,        // K
  damage: 0,               // 0=integro, 1=rotto
  scale: [1, 1, 1],        // scala X,Y,Z
  localDensity: null,        // override locale
  localTemperature: null,
  localStress: 0,
  localStrain: 0,
  fillCoefficient: 0.707,    // rapporto sfera/lato voxel
  localFillCoefficient: null
}
```

### 2.2 Materiali come "ricette"

I materiali sono parametri variabili, non geometria salvata:

| Proprietà | Descrizione |
|-----------|-------------|
| `color` | rendering |
| `density` | massa, inerzia |
| `youngsModulus` | rigidità |
| `poissonRatio` | comportamento compressione |
| `thermalConductivity` | simulazione termica |
| `fillCoefficient` | densità materiale |
| `staticFriction/kineticFriction` | attriti contatto |
| `fatigueLimit` | limite fatica ciclica |
| `thermalExpansion` | coefficiente espansione |
| `restitution` | elasticità urto |

### 2.3 Moduli Funzionali (Scene Graph)

Organizzazione gerarchica dei voxel:

```
Vehicle
  ├── Frame
  │   ├── Front_Longeron
  │   └── Rear_Longeron
  ├── Bodywork
  │   ├── Hood
  │   ├── Front_Left_Fender
  │   └── Left_Door
  ├── Front_Left_Wheel
  │   ├── Rim
  │   ├── Tire
  │   └── Brake_Disc
  └── Engine
      ├── Engine_Block
      └── Cylinder_Head
```

### 2.4 Rappresentazione Sferica

La materia reale non è un cubo perfetto. Usa sfere:

| Rapporto R/L | Stato fisico |
|--------------||----------------|
| 0.3 | Aerogel, materiale poroso |
| 0.5 | Schiuma, materiale espanso |
| 0.707 (√2/2) | Densità standard |
| 1.0 | Materiale compatto |

### 2.5 Tetraedri per Simulazione FEM

Suddivisione voxel in tetraedri:

```
Voxel 1×1×1 (8 nodi)
  ├── Tetra 1: nodi 0,1,2,4
  ├── Tetra 2: nodi 0,2,3,4
  ├── Tetra 3: nodi 0,3,7,4
  ├── Tetra 4: nodi 0,7,6,4
  └── Tetra 5: nodi 0,6,5,4
```

---

## 3. Architettura del Sistema

### 3.1 Struttura Directory

```
pro.cardesign/
├── src/                    # Codice sorgente JavaScript (ES Modules)
│   ├── main.js            # Entry point (init scena, camera, UI)
│   ├── vite.config.js     # Configurazione Vite + module type
│   ├── voxel-engine.js    # Motore voxel principale
│   ├── material-system.js # Database materiali
│   ├── module-system.js   # Gerarchia moduli
│   ├── physics-calc.js    # Calcoli fisici
│   ├── mesh-exporter.js   # Export OBJ/STL
│   ├── ui.js              # UI pannelli e toolbar
│   ├── geometry/
│   │   ├── converters/
│   │   │   ├── voxelToMesh.js  # Voxel → mesh
│   │   │   └── meshToVoxel.js  # Mesh → voxel
│   │   ├── primitives.js       # Cylinder, cone, sphere
│   │   ├── Decimator.js        # Mesh decimation
│   │   └── AutoDecimator.js    # Automatic decimation
│   ├── boolean/          # Operazioni booleane
│   │   ├── BooleanOperations.js
│   │   ├── OptimizedBoolean.js
│   │   ├── VoxelBooleanIntegration.js
│   │   └── BooleanPreview.js
│   ├── model/            # Modelli ibridi voxel-mesh
│   │   ├── HybridModel.js
│   │   ├── EditableMeshModel.js
│   │   └── VoxelModel.js
│   └── core/             # Strumenti editing e analisi
│       ├── brick-system.js         # Brick frontend
│       ├── brick-adapter.js        # Brick adapter
│       ├── component-library.js    # Parametric components
│       ├── scaling-tool.js         # Drag-to-scale tool
│       ├── stl-import.js           # STL parser + QualityAnalyzer
│       ├── vertex-edit-tool.js     # Vertex editing
│       ├── sculpt-tool.js          # Voxel-based sculpting
│       ├── hole-tool.js            # Drill/counterbore/thread
│       ├── move-tool.js            # Drag-to-move voxels
│       ├── mesh-point-edit-tool.js # Mesh point editing
│       ├── lod-manager.js          # Dynamic LOD
│       ├── gpu-compute.js          # WebGPU compute shaders
│       ├── chunk-system.js         # Sparse voxel storage (16³)
│       ├── sphere-system.js        # Voxel → spheres
│       ├── tetrahedral-mesh.js     # FEM tetra decomposition
│       ├── stress-analysis.js      # Stress/strain FEM
│       ├── aerodynamics.js         # Cd/Cl/Reynolds coefficients
│       ├── physics-signature.js    # Aggregated physics
│       ├── collision-detection.js  # Collision detection
│       ├── procedural-engine.js    # Rule-based generation
│       ├── rule-editor-ui.js       # Procedural rules UI
│       ├── depth-estimation.js     # AI 2D→3D with ONNX
│       ├── video-keyframe-extraction.js
│       ├── mesh-deformer.js        # Mesh deformation
│       ├── lego-bars.js            # LEGO-style connectors
│       └── library/                # Component libraries
│           ├── mattoncini.js
│           ├── cantiere.js
│           └── finiture.js
├── core/                  # Python backend (NumPy + pytest)
│   ├── __init__.py       # Module init
│   ├── brick.py          # Dataclass Brick (mm, volume, overlap)
│   ├── component.py      # ComponentDefinition/Instance/Library
│   ├── hole.py           # Hole operations (drill, counterbore, thread)
│   └── bike_demo.py      # Demo script
├── tests/
│   ├── test_coverage.py   # Test Python (93/93 ✅)
│   ├── test_coverage.js   # Test JavaScript (244/244 ✅)
│   └── COVERAGE_REPORT.md
├── documentationASI/      # Documentazione italiana AI
├── index.html             # Entry HTML
├── vite.config.js         # Configurazione Vite
└── package.json           # Dipendenze
```

### 3.2 Flusso Dati

```
INPUT
  ├── Sketch 2D / Immagine / Video / Comandi
  ↓
AI INTERPRETATION LAYER (Fase 6-8)
  ↓
PROCEDURAL RULE ENGINE
  ↓
SPATIAL VOXEL CORE
  ↓
SURFACE EXTRACTION (Marching Cubes)
  ↓
MESH OPTIMIZATION
  ↓
REALTIME RENDERER
  ↓
EXPORT OBJ / STL / GLTF
```

---

## 4. Stato delle Funzionalità

### ✅ FASE 1 — Motore Voxel Base [COMPLETATA]

- Griglia 3D con InstancedMesh (1 draw call per materiale)
- Sistema materiali con 8 preset: steel, aluminum, titanium, carbon, rubber, glass, copper, foam
- Voxel con proprietà: posizione, materiale, modulo, scale
- Calcolo massa, CoM, inerzia per voxel/modulo
- Salvataggio/caricamento progetti JSON
- Export OBJ e STL (ASCII e binario)

### ✅ FASE 2 — Editor 3D Interattivo [COMPLETATA]

- Strumenti: Add (A), Remove (R), Select (V), Fill (F), Scaling (S), Sculpt (D), Move (M), Hole (H), Vertex Edit (E)
- OrbitControls + mouse navigation
- Ghost preview + highlight box
- Undo/Redo (50 passi)
- Pannelli UI completi
- Simulazione fisica on-demand

### ✅ FASE 3 — Ottimizzazione Performance [COMPLETATA]

- Chunk System 16³ con `_updateChunksBasedOnCamera()` throttling
- LOD Manager integrato in main.js
- Surface mesh con estrazione facce esterne
- Wireframe mesh opzionale

### ✅ FASE 4 — Simulazioni Fisiche [COMPLETATA BASE]

- `StressAnalysis.js` — stress/strain calculation
- `PhysicsSignature.js` — firma fisica aggregata
- `Aerodynamics.js` — coefficienti Cd/Cl
- `CollisionDetection.js` — rilevamento collisioni

### ✅ FASE 5 — Rappresentazione Materia [COMPLETATA]

- `SphereSystem.js` — voxel → sfere con fillCoefficient
- `TetrahedralMesh.js` — decomposizione MacNeal
- Metadati materiali estesi (friction, fatigue, thermal)

### ✅ FASE 6 — Integrazione AI [COMPLETATA BASE]

- `DepthEstimation` — ONXX Runtime + fallback
- `ObjectSegmentation` — SAM stub
- `ProceduralRuleGeneration` — generazione regole

### ✅ FASE 7 — Video Reconstruction [COMPLETATA]

- Keyframe extraction con scene change detection
- Interpolazione trasformazioni camera
- Timeline playback

### ⏳ FASE 8 — GPU Compute [IN CORSO]

- WebGPU compute shaders per LOD
- Frame throttling per scene grandi

---

## 5. Stack Tecnologico

| Layer | Tecnologia | Versione | Stato |
|-------|------------|----------|-------|
| 3D Engine | Three.js | r167 | ✅ |
| Build | Vite | 5.x | ✅ |
| Bundle | ES Modules | — | ✅ |
| Export | Custom writer | — | ✅ |
| AI Vision | PyTorch → ONNX.js | — | ✅ Base |
| Depth | MiDaS/ZoeDepth | — | ✅ |
| Segmentazione | SAM (Meta) | — | ✅ Stub |
| FEM/Physics | Custom + Numeric.js | — | ✅ Base |
| GPU Compute | WebGPU shaders | — | 🟡 |

---

## 6. API Reference

### VoxelEngine (`src/voxel-engine.js`)

```javascript
new VoxelEngine(scene, materialDB, moduleSystem, camera, renderer, controls)

// Lettura
getVoxelAt(x, y, z)        → voxel data | null
getAllVoxels()             → Array<voxelData>
getVoxelCount()            → number
getSelectedVoxel()         → {x, y, z} | null

// Scrittura
addVoxel(pos, material, moduleId) → void
removeVoxel(x, y, z)            → void
selectVoxel(x, y, z)             → void
clearAll()                       → void

// Primitive
addCylinder(pos, radius, height, material) → Array<pos>
addCone(pos, radius, height, material)      → Array<pos>
addSphere(pos, diameter, material)         → Array<pos>

// Tool
setTool('add' | 'remove' | 'select' | 'fill' | 'scaling' | 'sculpt' | 'move' | 'hole' | 'vertexEdit')
setMaterial(name)

// Persistenza
toJSON()   → object
fromJSON(data) → void

// Mesh
toggleSurfaceMesh()
toggleWireframe()

// Camera
setCameraNavigationMode(true/false)
fitCameraToVoxels()
setCameraView('front'|'right'|'top'|'iso')
zoomCamera(factor)
resetCamera()
```

### MaterialSystem (`src/material-system.js`)

```javascript
new MaterialSystem()

get(name)           → material | null
getAll()            → Array<material>
getDensity(name)    → number (kg/m³)
getVoxelMass(voxel) → number
getVoxelWeight(voxel) → number
add(material)       → boolean
remove(name)        → boolean
count()             → number
```

### ModuleSystem (`src/module-system.js`)

```javascript
new ModuleSystem(materialDB)

createRoot(name)           → moduleId
createModule(name, parentId) → moduleId | null
removeModule(moduleId)     → boolean
get(moduleId)              → Module | null
getAll()                   → Array<Module>
getChildren(moduleId)      → Array<Module>
getTree(moduleId)          → { id, name, voxelCount, children: [...] }
getVoxelsForModule(id)     → Array<voxelData>
assignVoxelToModule(key, moduleId) → boolean
toJSON()                   → serializable
fromJSON(data)             → void
```

### PhysicsCalc (`src/physics-calc.js`)

```javascript
new PhysicsCalc(materialDB, moduleSystem)

voxelMass(voxel, volume)         → number
voxelWeight(voxel)               → number
calculateAllVoxels(voxels)         → { totalMass, centerOfMass, inertia, materialDistribution }
calculateModule(moduleId, engine)  → { ..., moduleName }
calculateVehicle(engine)           → { ... }

// Static utilities
PhysicsCalc.densityFromMassVolume(mass, volume) → number
PhysicsCalc.massFromDensityVolume(density, volume) → number
PhysicsCalc.volumeFromMassDensity(mass, density) → number

thermalAnalysis(voxels, ambientTemp, heatSourceTemp) → { ... }
suggestMaterial(minStrength, maxWeight) → Array<material>
```

### MeshExporter (`src/mesh-exporter.js`)

```javascript
new MeshExporter()

voxelToGeometry(voxels, voxelSize, smooth)  → THREE.BufferGeometry
exportOBJ(geometry)                         → string
exportSTLASCII(geometry)                      → string
exportSTLBinary(geometry)                     → Blob
```

---

## 7. Guida Sviluppatore

### Setup Ambiente

```powershell
# Prerequisiti
node --version  # v18+ (v24 OK)
npm --version

# Installazione
npm install

# Sviluppo (frontend Vite)
npm run dev
# → http://localhost:5176

# Build produzione
npm run build
# → dist/index.html + dist/assets/
```

### Aggiungere un Materiale

In `src/material-system.js`, metodo `_defaults()`:

```javascript
{
  name: 'mio_materiale',
  label: 'My Material',
  color: 0xFF5733,
  density: 4500,
  youngsModulus: 50e9,
  poissonRatio: 0.3,
  thermalConductivity: 100,
  specificHeat: 500,
  meltingPoint: 1200,
  costPerKg: 4.5,
  roughness: 0.4,
  metalness: 0.8,
  fillCoefficient: 0.707,
  staticFriction: 0.74,
  kineticFriction: 0.57,
  restitution: 0.5,
  fatigueLimit: 200e6,
  thermalExpansion: 11e-6
}
```

### Struttura Nuovo Modulo

```javascript
// src/nuovo-modulo.js
export class NuovoModulo {
  constructor(dependency1, dependency2) {
    this.dependency1 = dependency1;
    this.dependency2 = dependency2;
  }
  
  doSomething(param) {
    // ...
  }
}

// In src/main.js:
import { NuovoModulo } from './nuovo-modulo.js';
const nuovo = new NuovoModulo(engine, materialDB);
```

### Debug Raycasting

```javascript
// Nel browser console (F12)
window.voxelEngine.voxels.forEach((v, k) => console.log(k, v));
window.voxelEngine.addVoxel({x:0,y:0,z:0}, 'steel', null);
```

### Export Mesh

```javascript
const exporter = window.voxelEngine.meshExporter;
const geometry = exporter.voxelToGeometry(window.voxelEngine.voxels, 1.0, false);
const objString = exporter.exportOBJ(geometry);
```

### Test

```bash
# Python — 84 test
python -m pytest tests/test_coverage.py -v
python -m pytest tests/test_coverage.py --cov=core

# JavaScript — ~50 test strutturali
node tests/test_coverage.js
```

---

## 8. Roadmap

| Fase | Feature | Stato |
|------|---------|-------|
| 1 | Voxel Engine base | ✅ |
| 2 | Editor 3D interattivo | ✅ |
| 3 | Chunk System + Marching Cubes | ✅ |
| 4 | Simulazioni fisiche avanzate | ✅ Base |
| 5 | Rappresentazione materia (sfere, tetraedri) | ✅ |
| 6 | Integrazione AI | ✅ Base |
| 7 | Video Reconstruction | ✅ |
| 8 | GPU Compute (WebGPU) | 🟡 |
| 9 | Editor regole procedurali avanzato | ⏳ |

### Prossimi Step

- [ ] Editor regole procedurali drag-drop UI
- [ ] GPU Compute completato
- [ ] Test aerodinamica oggetti complessi
- [ ] Validazione FE locale

---

*Documentazione unificata del progetto VoxelCAD*  
*Ultimo aggiornamento: 2026-05-29*