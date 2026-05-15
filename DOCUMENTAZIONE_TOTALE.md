# VoxelCAD — Documentazione Totale

**Versione:** 1.0  
**Data:** 2026-05-15  
**Repository:** github.com/ballales1984-wq/pro.cardesign  

---

## Indice

1. [Panoramica del Progetto](#1-panoramica-del-progetto)
2. [ Filosofia e Concetti Chiave](#2-filosofia-e-concetti-chiave)
3. [Architettura del Sistema](#3-architettura-del-sistema)
4. [Stack Software](#4-stack-software)
5. [Guida Sviluppatore](#5-guida-sviluppatore)
6. [API Reference](#6-api-reference)
7. [Guida Utente](#7-guida-utente)
8. [Piano di Sviluppo](#8-piano-di-sviluppo)

---

## 1. Panoramica del Progetto

**VoxelCAD** è un software di modellazione 3D ibrido che combina:

- **Modellazione voxel**: editing diretto di volumi 3D
- **Proprietà fisiche**: ogni voxel ha materiale, densità, temperatura, attrito, rigidezza
- **Geometria procedurale**: regole invece di geometria salvata
- **AI-assisted** (pianificato): riconoscimento immagini → regole procedurali
- **Esportazione industriale**: OBJ, STL, glTF

### Cosa fa che non fanno gli altri CAD

| Funzionalità | VoxelCAD | CAD tradizionali | Editor voxel semplici |
|---|---|---|---|
| Proprietà fisiche per voxel | ✅ | ❌ (solo superficie) | ❌ |
| Gerarchia moduli funzionali | ✅ | ✅ (feature tree) | ❌ |
| Regole procedurali | 🔄 in sviluppo | ✅ | ❌ |
| AI da immagini | ⏳ pianificato | ❌ | ❌ |
| Export OBJ/STL | ✅ | ✅ | ✅ |

---

## 2. Filosofia e Concetti Chiave

### 2.1 Voxel intelligente

Ogni voxel non è solo un colore: è un **campione di materia** con proprietà fisiche:

```javascript
{
  x: 0, y: 0, z: 0,      // coordinate griglia
  material: 'steel',      // nome del materiale
  moduleId: 3,            // appartiene al modulo "Telaio"
  // proprietà derivate dal materiale:
  // density = 7850 kg/m³
  // youngsModulus = 210 GPa
  // thermalConductivity = 50 W/(m·K)
  // roughness = 0.3
}
```

### 2.2 Materiali come "ricetta" della materia

Il sistema non salva materiali completi, ma **parametri** che possono essere variati:

```
Materiale = {
  colore,           → rendering
  densità,          → massa, inerzia
  moduloYoung,      → rigidezza, deformazione
  PoissonRatio,     → comportamento compressione
  conducibilità termica, → simulazione termica
  caloreSpecifico,  → accumulo energia termica
  puntoFusione,     → limiti operativi
  rugosità,         → attrito superficiale
  costoPerKg,       → stima economica
}
```

### 2.3 Moduli funzionali (Scene Graph)

I voxel sono organizzati in una **gerarchia di moduli** che corrisponde a parti funzionali reali:

```
Veicolo
 ├── Telaio
 │   ├── Longherone_anteriore
 │   └── Longherone_posteriore
 ├── Carrozzeria
 │   ├── Cofano
 │   ├── Parafango_FL
 │   └── Portiera_sx
 ├── Ruota_FL [modulo]
 │   ├── Cerchio
 │   ├── Pneumatico
 │   └── Disco_freno
 └── Motore
     ├── Blocco_motore
     ├── Testata
     └── Albero_a_camme
```

Ogni modulo ha:
- VoxelKeys: lista di voxel che gli appartengono
- Proprietà: tolleranza, peso target, rigidezza minima, stress massimo
- Metadati: icona, colore, visibilità, blocco editing

### 2.4 Firma fisica dell'oggetto

L'oggetto finale non è la somma dei voxel: è la **firma emergente**:

```
Firma fisica = funzione delle proprietà locali → comportamento globale

Input:     { voxel_i.material, voxel_i.posizione, voxel_i.temperatura }
           ↓
Calcolo:   { massa, CoM, inerzia, distribuzione materiali }
           { mappa di stress, mappa di temperatura }
           { superficie esposta, coefficiente aerodinamico }
Output:    Firma fisica completa dell'oggetto
```

### 2.5 Il ruolo delle sfere nella rappresentazione della materia

La materia reale non è una griglia di cubi perfetti. È un insieme di particelle con spazi vuoti:

```
Voxel (cubo)          Rappresentazione semplificata
   ┌───┐                  🎱🎱🎱 ← sfere
   │   │
   └───┘

Raggio sfera = voxelSize × fillCoefficient

fillCoefficient = 0.5  →  Porosità ~50% (schiuma)
fillCoefficient = 0.707→  Densità standard (sfere si toccano su spigolo)
fillCoefficient = 1.0  →  Materiale completamente compatto
fillCoefficient = 0.3  →  Aerogel / materiali rarefatti
```

Le sfere sono:
- **Default di esportazione** per simulazioni CFD/FEM esterne
- **Base per le simulazioni** (sfere = particelle, spazi vuoti = vuoti o aria)

### 2.6 Tetraedri per simulazioni FEM

Ogni voxel/cella viene suddiviso in tetraedri per le simulazioni di stress:

```
Voxel 1×1×1 (8 nodi)
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

Suddivisione MacNeal:
  Tetraedro A: nodi 0,1,2,4
  Tetraedro B: nodi 0,2,3,4
  Tetraedro C: nodi 0,3,7,4
  Tetraedro D: nodi 0,7,6,4
  Tetraedro E: nodi 0,6,5,4
```

Ogni tetraedro eredita le proprietà del materiale del voxel e calcola:
- **Matrice di rigidezza locale K** (dipende da E, ν e geometria)
- **Tensore di tensione σ** (dalle forze applicate)
- **Deformazione ε** (spostamenti nodi)

---

## 3. Architettura del Sistema

### 3.1 Struttura cartelle progetto

```
pro.cardesign/
├── src/                          # Codice sorgente applicazione
│   ├── main.js                   # Entry point (init scena, camera, UI)
│   ├── voxel-engine.js           # Motore voxel centrale
│   ├── material-system.js        # Database materiali
│   ├── module-system.js          # Gerarchia moduli
│   ├── physics-calc.js           # Calcoli fisici
│   ├── mesh-exporter.js          # Export OBJ/STL/glTF
│   ├── ui.js                     # Pannelli UI e toolbar
│   ├── procedural-engine.js      # [FUTURO] Regole procedurali
│   ├── sphere-system.js          # [FUTURO] Rappresentazione sferica
│   ├── tetrahedral-mesh.js       # [FUTURO] Suddivisione tetraedrica
│   ├── stress-analysis.js        # [FUTURO] FEM / analisi stress
│   └── thermal-sim.js            # [FUTURO] Simulazione termica
├── dist/                         # Build produzione
├── public/                       # Asset statici
├── styles/                       # Fogli CSS
├── node_modules/                 # Dipendenze
├── index.html                    # Entry HTML
├── main.js (root)                # Processo principale Electron
├── vite.config.js                # Configurazione Vite
├── package.json                  # Metadati progetto e dipendenze
├── DEVELOPMENT_PLAN.md           # Piano di sviluppo (stato attuale)
├── PIANO_SVILUPPO_COMPLETO.md    # Piano completo (questo file)
├── DOCUMENTAZIONE_TOTALE.md      # Questo file
└── ARCHITETTURA_VOXEL_PROCEDURALE_AI.md  # Architettura generale AI
```

### 3.2 Dipendenze

```
pro.cardesign/
├── three@^0.167.0              # Engine 3D
├── vite@^5.4.0                 # Build tool
├── concurrently@^8.0.0          # Avvia Vite + Electron insieme
├── wait-on@^7.2.0              # Attende che Vite sia pronto
└── electron@^42.1.0            # Desktop wrapper (volontario)
```

---

## 4. Stack Software

### 4.1 Stack attuale

| Layer | Libreria | Versione | Ruolo |
|---|---|---|---|
| 3D Engine | Three.js | r167 | Rendering WebGL, scene graph, geometrie |
| Build | Vite | 5.x | HMR, bundle, dev server |
| Bundle output | ES Modules | — | Import in browser supportati nativamente |
| Export mesh | Custom writer | — | OBJ ASCII, STL binario/ASCII |

### 4.2 Stack pianificato

| Layer | Libreria | Motivo scelta |
|---|---|---|
| AI Vision | PyTorch + ONNX.js | Depth estimation, segmentazione, VLM |
| Segmentazione | SAM (Meta) | Riconoscimento oggetti senza training |
| Depth | MiDaS / ZoeDepth | Depth da singola immagine |
| Mesh processing | Open3D / Trimesh | Processing mesh + voxel grid |
| FEM / Physics | Custom + Numeric.js | Stress analysis termica/strutturale |
| GPU Compute | WebGPU shaders | Voxel update, marching cubes, simulazioni |
| Rendering avanzato | Three.js + Nanite-like | LOD adattivo, istanze GPU |

---

## 5. Guida Sviluppatore

### 5.1 Setup ambiente

```powershell
# Prerequisiti
node --version  # v18+ raccomandato (v24 OK)
npm --version

# Installazione dipendenze
npm install

# Avvio sviluppo (solo frontend Vite, funziona sempre)
npm run dev
# → http://localhost:5176

# Build produzione
npm run build
# → dist/index.html + dist/assets/

# Solo Vite (senza Electron)
npx vite --port 5176 --strictPort
```

### 5.2 Struttura di un nuovo modulo

```javascript
// src/nuovo-modulo.js
export class NuovoModulo {
  constructor(dependency1, dependency2) {
    this.dependency1 = dependency1;
    this.dependency2 = dependency2;
  }

  // Metodo principale
  doSomething(param) {
    // ...
  }
}

// In src/main.js, importa e istanzia:
import { NuovoModulo } from './nuovo-modulo.js';
const nuovo = new NuovoModulo(engine, materialDB);
```

### 5.3 Aggiungere un materiale

In `src/material-system.js`, nella `_defaults()`:

```javascript
{
  name: 'mio_materiale',
  label: 'Mio Materiale',
  color: 0xFF5733,
  density: 4500,                // kg/m³
  youngsModulus: 50e9,          // Pa (modulo di elasticità)
  poissonRatio: 0.3,            // senza unità
  tensileStrength: 250e6,       // Pa
  thermalConductivity: 100,     // W/(m·K)
  specificHeat: 500,            // J/(kg·K)
  meltingPoint: 1200,           // °C
  costPerKg: 4.5,               // €/kg
  recyclable: true,
  roughness: 0.4,               // 0 = specchiato, 1 = ruvido
  metalness: 0.8,               // 0 = dielettrico, 1 = metallico
}
```

### 5.4 Aggiungere una proprietà fisica al voxel

Modificare `src/voxel-engine.js` nel costruttore `VoxelEngine` e in `addVoxel()`:

```javascript
// Nel costruttore, quando crei il nuovo voxel data:
const voxelData = {
  x, y, z,
  material: this.activeMaterial,
  moduleId: this.activeModule?.id || null,
  densita: mat.density,        // ← nuova proprietà
  temperatura: 25,              // ← nuova proprietà (°C)
  stress: 0,                    // ← da simulazione
};

// Salvalo nella griglia:
this.voxels.set(key, voxelData);
```

### 5.5 Debugging raycasting

Il raycaster usa `Raycaster.intersectObject()` con il criterio "prima i voxel, poi ground plane":

```
Ray (da camera verso mouse)
    ↓
Intersect voxel InstancedMesh → hit.instanceId → voxelKey → coordinate XYZ
    ↓
Se nessun voxel → Intersect ground plane → coordinate XZ su Y=0
```

Per debuggare: apri la console browser (F12) e scrivi:
```javascript
// Mostra tutti i voxel in scena
window.voxelEngine.voxels.forEach((v, k) => console.log(k, v));

// Forza aggiungi voxel a (0,0,0)
window.voxelEngine.addVoxel({x:0,y:0,z:0}, 'steel', null);
```

### 5.6 Esportazione mesh

```javascript
// In console browser:
const exporter = window.voxelEngine.meshExporter;
const geometry = exporter.voxelToGeometry(window.voxelEngine.voxels, 1.0, false);
const objString = exporter.exportOBJ(geometry);
// Scarica il file
const blob = new Blob([objString], {type: 'text/plain'});
const url = URL.createObjectURL(blob);
const a = document.createElement('a');
a.href = url; a.download = 'mesh.obj'; a.click();
```

---

## 6. API Reference

### `VoxelEngine` (`src/voxel-engine.js`)

```javascript
// Costruttore
new VoxelEngine(scene, materialDB, moduleSystem, camera, renderer, controls)

// Lettura
getVoxelAt(x, y, z)        → {x, y, z, material, moduleId} | null
getAllVoxels()              → Array<voxelData>
getVoxelCount()             → number
getSelectedVoxel()          → {x, y, z} | null

// Scrittura
addVoxel(pos, materialName, moduleId) → void
removeVoxel(x, y, z)                 → void
selectVoxel(x, y, z)                → void
clearAll()                           → void

// Strumenti
setTool('add' | 'remove' | 'select' | 'fill')
setMaterial(name)

// Salvataggio / caricamento
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

getTree()    → albero gerarchico completo (root = Veicolo)
toJSON()     → oggetto serializzabile
fromJSON(data) → ricostruisce da oggetto
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

// Utility statiche
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
_exportOBJ(geometry, voxels, voxelSize)       → string (formato OBJ ASCII)
_exportSTLASCII(geometry)                     → string (formato STL ASCII)
_exportSTLBinary(geometry)                    → Blob (formato STL binario)
```

### `ProceduralEngine` — API prevista (Fase 4)

```javascript
// src/procedural-engine.js [FUTURO]

new ProceduralEngine(voxelEngine)

// Registra una regola procedurale
registerRule(name, ruleObject) → void

// Esegui una regola → ritorna i voxel generati
execute(ruleName, params) → Array<voxelData>

// Regole primitiva
primitives.LINEA({ lunghezza, asse: 'x'|'y'|'z', offset })
primitives.CUBO({ x, y, z, width, height, depth })
primitives.ESTRUSIONE({ profilo, altezza })
primitives.SIMMETRIA({ asse, assi })
primitives.RIVOLUZIONE({ profilo, raggi })
```

---

## 7. Guida Utente

### 7.1 Avvio

```powershell
# Metodo 1: Vite nel browser (sempre funziona)
npm run dev
# → Apri http://localhost:5176 nel browser

# Metodo 2: Electron desktop
# Attualmente richiede fix Electron su Windows — vedi Problemi Noti
npm start
```

### 7.2 Controlli base

| Azione | Controllo |
|---|---|
| Ruotare camera | Tasto sinistro mouse + trascina |
| Zoom | Rotella mouse |
| Pan camera | Tasto destro mouse + trascina |
| Aggiungi voxel | Tasto sinistro su voxel esistente (tool A) |
| Rimuovi voxel | Tasto destro su voxel (tool R) |
| Seleziona voxel | Click sinistro (tool V) |
| Fill livello | Click sinistro su una faccia (tool F) |

### 7.3 Strumenti (toolbar in alto)

| Icona | Strumento | Descrizione |
|---|---|---|
| **V** | Seleziona | Seleziona un voxel e mostra proprietà |
| **A** | Aggiungi | Piazza un nuovo voxel adiacente al voxel cliccato |
| **R** | Rimuovi | Elimina il voxel cliccato |
| **F** | Fill | Riempie un livello Y intero con il materiale corrente |

### 7.4 Selezione materiale

Pannello laterale sinistro: *Material Palette*

Ogni materiale mostrato con:
- Nome e colore
- Densità (kg/m³)
- Modulo Young (GPa)
- Conducibilità termica (W/(m·K))
- Rugosità

Clicca un materiale per renderlo attivo. Il voxel successivo che piazzerai userà questo materiale.

### 7.5 Proprietà voxel selezionato

Quando selezioni un voxel (tool V) il pannello *Properties* mostra:
- Coordinate (x, y, z)
- Materiale corrente
- Modulo di appartenenza

### 7.6 Fisica del modello

Pulsante **Calcola Fisica** nel pannello *Physics*:
- Massa totale
- Volume totale
- Densità media
- Centro di massa (x, y, z)
- Inerzia (Ixx, Iyy, Izz)
- Distribuzione materiali (conta voxel per materiale)

### 7.7 Esportazione

Pulsante **Export Mesh (OBJ/STL)**:
- Scegli formato: OBJ ASCII, STL ASCII, STL Binario
- Il file viene scaricato automaticamente

### 7.8 Salvataggio progetto

Pulsante nella toolbar:
- **Salva Progetto** → salva `progetto.json` (tutti i voxel + moduli + impostazioni)
- **Carica Progetto** → carica da `progetto.json`
- **Reset** → svuota la scena

---

## 8. Piano di Sviluppo

Vedi [PIANO_SVILUPPO_COMPLETO.md](./PIANO_SVILUPPO_COMPLETO.md) per il piano dettagliato fase per fase.

### Breve riepilogo

| Fase | Nome | Stato |
|---|---|---|
| 1 | Motore Voxel Base | ✅ Completata |
| 2 | Editor 3D | ✅ Completata |
| 3 | Ottimizzazione Performance | 🔄 In corso (chunk, marching cubes) |
| 4 | Motore Procedurale | ⏳ Da iniziare |
| 5 | Rappresentazione Materia (sfere, tetraedri) | ⏳ Nuova — alta priorità |
| 6 | Simulazioni Fisiche | ⏳ Da iniziare |
| 7 | Motore AI | ⏳ Da iniziare |
| 8 | Video Reconstruction | ⏳ Da iniziare |

### Prossima milestone immediata

```
Fase 3: Chunk System + Marching Cubes completo
  → Obiettivo: scena fluida a 60fps con 50.000+ voxel
  → File: voxel-engine.js (refactor), mesh-exporter.js (MC completo)
```

---

*Documento principale del progetto VoxelCAD*  
*Vedi anche: [PIANO_SVILUPPO_COMPLETO.md](./PIANO_SVILUPPO_COMPLETO.md) · [ARCHITETTURA_VOXEL_PROCEDURALE_AI.md](./ARCHITETTURA_VOXEL_PROCEDURALE_AI.md)*
