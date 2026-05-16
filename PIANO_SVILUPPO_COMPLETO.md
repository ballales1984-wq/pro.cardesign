# VoxelCAD — Piano di Sviluppo Completo

**Versione documento:** 1.0  
**Data:** 2026-05-15  
**Stato:** Fase 2 completata — Fase 3 in corso

---

## Indice

1. [Filosofia del sistema](#1-filosofia-del-sistema)
2. [Architettura generale](#2-architettura-generale)
3. [Stato attuale — cosa c'è già](#3-stato-attuale--cosa-ce-già)
4. [Piano di sviluppo fase per fase](#4-piano-di-sviluppo-fase-per-fase)
5. [Roadmap tecnologica](#5-roadmap-tecnologica)
6. [Task correnti e prossime milestone](#6-task-correnti-e-prossime-milestone)

---

## 1. Filosofia del sistema

### 1.1 Cosa NON si salva

- Milioni di triangoli
- Voxel completi permanenti
- Tutti i frame di un video
- Tutte le mesh intermedie

### 1.2 Cosa SI salva

| Cosa | Perché |
|---|---|
| **Regole** | Ricostruiscono la geometria a runtime |
| **Parametri** | Permettono modifiche parametriche senza riscrivere la geometria |
| **Trasformazioni spaziali** | Posizione, rotazione, scala per ogni elemento |
| **Riferimenti modulari** | Gerarchia Veicolo → Telaio → Ruota |
| **Proprietà materiali** | Densità, attrito, conducibilità, etc. |

### 1.3 La geometria è runtime

La geometria viene generata, ricostruita e convertita in mesh solo quando necessario (esportazione, rendering avanzato).

---

## 2. Architettura generale

```
┌─────────────────────────────────────────────────────────┐
│                  INPUT                                  │
│   Sketch 2D / Immagine / Video / Comandi diretti        │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│          AI INTERPRETATION LAYER (Fase 6-8)             │
│   Vision Transformer → Depth Estimation → Segmentazione │
│               → Procedural Rule Generation              │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│       PROCEDURAL RULE ENGINE (Fase 4)                   │
│   LINEA, CUBO, ESTRUSIONE, SIMMETRIA, ecc.             │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│          SPATIAL VOXEL CORE (Fase 1-3 — PARZIALE)      │
│   Sparse Voxel Storage + InstancedMesh + Chunk System   │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│       SURFACE EXTRACTION (Fase 3 — da completare)       │
│   Marching Cubes o Dual Contouring                      │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│       MESH OPTIMIZATION (Fase 3 — da completare)        │
│   Retopology + Welding + LOD                            │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│       REALTIME RENDERER (Fase 1 — funzionante)          │
│   Three.js / WebGL → OrbitControls + InstancedMesh      │
└───────────────────────┬─────────────────────────────────┘
                        ↓
┌─────────────────────────────────────────────────────────┐
│       EXPORT OBJ / STL / GLTF (Fase 1 — funzionante)    │
└─────────────────────────────────────────────────────────┘
```

---

## 3. Stato attuale — cosa c'è già

### 3.1 File sorgente principali

| File | Righe | Cosa fa |
|---|---|---|
| `src/voxel-engine.js` | ~590 | Motore voxel principale: griglia, instancing, raycasting, strumenti |
| `src/material-system.js` | ~188 | Database materiali con proprietà fisiche (acciaio, carbonio, titanio, ecc.) |
| `src/module-system.js` | ~209 | Gerarchia moduli funzionali (Telaio, Ala, Motore, etc.) |
| `src/physics-calc.js` | ~222 | Calcoli massa, CoM, inerzia, distribuzione materiali, analisi termica |
| `src/ui.js` | ~500 | Pannelli UI: materiali, moduli, proprietà, fisica, salvataggio/caricamento |
| `src/mesh-exporter.js` | ~278 | Esportazione OBJ/STL/glTF, _simpleCubes + _marchingCubes base |
| `src/main.js` | ~90 | Entry point Electron con fallback Vite |

### 3.2 Stack confermato

| Layer | Libreria | Stato |
|---|---|---|
| Runtime | Node.js v24 (nvm4w) | ✅ |
| Build | Vite 5.4 | ✅ |
| 3D | Three.js r167 | ✅ |
| GUI | Vite + HTML/CSS (Elect pianificato) | 🟡 Parziale |
| AI (CPU/GPU) | PyTorch, ONNX.js (pianificato) | ⏳ Da iniziare |
| Export | OBJ, STL (binario/ASCII) | ✅ |
| Marching Cubes | Semplice (cubi esposti) | 🟡 Base |

### 3.3 Bug risolti

| Bug | Fix applicato |
|---|---|
| Ground plane esclusa dal frustum culling | `groundPlane.frustumCulled = false` |
| `raycaster.intersectObject(groundPlane)` senza flag | `intersectObject(groundPlane, false)` |
| `hit.faceNormal` può essere `null` | Fallback `{x:0,y:0,z:1}` |
| Highlight stale dopo transizione ground→voxel | Highlight sempre aggiornato |
| `mesh.count` non incrementato su nuova istanza | `mesh.count = instanceId + 1` |

---

## 4. Piano di sviluppo fase per fase

---

### ✅ FASE 1 — Motore Voxel Base [COMPLETATA]

**Obiettivo:** griglia 3D funzionante con proprietà fisiche per ogni voxel.

**Completato:**

- Griglia 3D con rendering Three.js + InstancedMesh (1 draw call per materiale)
- Sistema materiali con 8 presets: acciaio, alluminio, titanio, fibra di carbonio, schiuma PU, gomma, vetro, rame
- Proprietà per voxel: `{ x, y, z, material }`
- Calcolo massa, centro di massa, inerzia per ogni voxel/modulo
- Salvataggio/caricamento progetti JSON
- Esportazione OBJ e STL (ASCII e binario)

**Codice:** `src/voxel-engine.js`, `src/material-system.js`, `src/physics-calc.js`, `src/module-system.js`

---

### ✅ FASE 2 — Editor 3D Interattivo [COMPLETATA]

**Obiettivo:** interfaccia utente per modellare con il mouse, gestire materiali e moduli.

**Completato:**

- Strumenti editor: Seleziona (V), Aggiungi (A), Rimuovi (R), Fill livello (F)
- OrbitControls (rotazione camera) + left-click piazza/rimuove voxel
- Ghost preview + highlight box sul voxel sotto il cursore
- Undo / Redo (50 passi)
- Pannelli UI: Material Palette, Module Tree, Properties Panel, Physics Panel
- Selezione materiale da palette
- Pannello fisica: massa totale, centro di massa, inerzia, distribuzione materiali
- Salvataggio/Caricamento/Reset progetto
- Export OBJ/STL da pulsante UI

**Codice:** `src/ui.js`, `src/main.js`

---

### ⚡ FASE 3 — Ottimizzazione Performance [IN CORSO]

**Obiettivo:** scene grandi (oltre i primi 1000 voxel) fluide a 60fps.

**Piano:**

#### 3.1 Chunk System + Sparse Voxel Storage (BLOCCANTE)
Attualmente tutta la scena è caricata in memoria. Serve:

```
Chunk 16³ = 4096 voxel per chunk
Sparse Map: Map<"x,y,z", VoxelData>
Caricamento dinamico chunk in base alla posizione camera
```

File: `src/voxel-engine.js` → refactor `this.voxels` da `Map` a `Map<string, Chunk>`

#### 3.2 Marching Cubes completo
Attualmente `_marchingCubes()` chiama `_simpleCubes()`. Serve l'algoritmo vero:

```
Input: griglia voxel binaria (occupato/non-occupato)
Output: mesh triangolare con vertici sugli spigoli
```

File: `src/mesh-exporter.js` → sostituire `_marchingCubes` con algoritmo completo (Paul Bourke / Wikipedia)

#### 3.3 Level of Detail (LOD) dinamico
- LOD 0: voxel completo (camera vicina < 5 unità)
- LOD 1: voxel ridotto a 2³ (camera media 5–20 unità)
- LOD 2: mesh semplificata (camera lontana > 20 unità)

#### 3.4 GPU Compute Shaders (futuro prossimo)
- `computeVoxelUpdate`: aggiorna matrici instancing su GPU
- `computeMarchingCubes`: estrazione superfici su GPU
- `computeSimulation`: propagazione stress/calore su GPU

#### 3.5 Streaming
- Carica/scarica chunk dinamicamente in base alla posizione camera
- Thread Web Worker per caricamento chunk in background

---

### ⏳ FASE 4 — Motore Procedurale [DA INIZIARE]

**Obiettivo:** generare/modificare oggetti tramite regole invece che voxel per voxel.

#### 4.1 Core Procedurale

**File:** `src/procedural-engine.js` (nuovo)

```
class ProceduralEngine {
  // Registro regole
  rules = new Map();

  // Operazioni primitive
  primitives = {
    LINEA:    { lunghezza, asse, offset },
    CUBO:     { dimensioni, orientamento },
    ESTRUSIONE:{ altezza, direzione, profilo },
    SIMMETRIA:{ asse, copie },
    SMUSS0:   { raggio, facce },
    FORO:     { diametro, profondità, asse },
  };

  // Esegui una regola → voxel risultanti
  execute(rule, context): VoxelSet;
}
```

#### 4.2 Editor di Regole

- UI per creare/modificare regole procedurali
- Anteprima in tempo reale della geometria generata
- Gerarchia di regole (come feature tree di Fusion 360)

#### 4.3 Operazioni Booleane

- Unione, differenza, intersezione tra volumi voxel
- Software: Binary Space Partitioning (BSP) o voxel carving

---

### ⏳ FASE 5 — Rappresentazione della Materia [NUOVA — PRIORITÀ ALTA]

**Origine discussione:** la materia non è solo colore. La geometria è un mezzo — il vero obiettivo è la **firma fisica** dell'oggetto.

#### 5.1 Sistema a Sfere Invece di Voxel

Il voxel è un **strumento di editing** comodo ma non realistico.  
La materia reale è meglio rappresentata da **insiemi di sfere**:

- Le sfere lasciano spazi vuoti tra loro → porosità naturale
- Gli spazi vuoti ≠ assenza di materia: significano aria, compressione, coefficiente di vuoto
- Il rapporto `raggio_sfera / lato_cubo` è il **coefficiente di riempimento** della materia:

| Rapporto R/L | Stato fisico |
|---|---|
| 0.3 | Materiale molto poroso / aerogel |
| 0.5 | Schiuma, materiale espanso |
| 0.707 (√2/2) | Densità standard → sfere si toccano su spigolo |
| 1.0 | Cubo completamente riempito → materiale compatto |
| > 1.0 | Sovra-compressione |

**Implementazione:**

```javascript
// Ogni voxel editato viene "tradotto" in sfere al salvataggio/export
class Sphere {
  x, y, z;        // centro (coordinate voxel * voxelSize)
  radius;         // R = voxelSize * fillCoefficient
  material;       // nome materiale
  fillCoefficient; // R / voxelSize (0.0 – 1.0+)
}
```

#### 5.2 Tetraedri come Elementi di Simulazione

Suddivisione di ogni voxel/cella in **tetraedri** per simulazioni FEM (Finite Element Method):

- Un cubo 1×1×1 → 5 tetraedri (decomposizione di MacNeal)
- Ogni tetraedro ha le sue proprietà:
  - matrice di rigidezza locale
  - tensore di deformazione
  - propagazione dello stress ai vicini

```
Cubo voxel (8 nodi)
  ├── Tetraedro 1: nodi 0,1,2,4
  ├── Tetraedro 2: nodi 0,2,3,4
  ├── Tetraedro 3: nodi 0,3,7,4
  ├── Tetraedro 4: nodi 0,7,6,4
  ├── Tetraedro 5: nodi 0,6,5,4
  └── Proprietà per tetraedro:
      - youngsModulus (dal materiale voxel)
      - poissonRatio
      - density
      - stress (calcolato)
      - strain (calcolato)
```

**Consegna:** `src/tetrahedral-mesh.js` (nuovo)

#### 5.3 Metadati Materiale Estesi

Aggiungere a `MaterialSystem`:

```javascript
{
  name: 'steel',
  // ... già esistente
  fillCoefficient: 0.707,  // default: sfere si toccano su spigolo
  roughnessProfile: 'Ra=0.8μm',  // rugosità superficiale
  porosity: 0.0,            // 0 = compatto, 1 = completamente poroso
  fatigueLimit: 200e6,      // Pa — limite di fatica ciclica
  thermalExpansion: 11e-6,  // 1/°C — coefficiente di espansione termica
  dampingRatio: 0.02,       // smorzamento vibrazioni
  magneticPermeability: 100,// permeabilità magnetica relativa
  // Coefficienti di contatto
  staticFriction: 0.74,     // attrito statico μs
  kineticFriction: 0.57,    // attrito dinamico μk
  restitution: 0.5,         // coefficiente di restituzione (elasticità urto)
}
```

#### 5.4 Proprietà Locali per Voxel

Oltre al materiale globale, ogni voxel può avere proprietà locali:

```javascript
{
  x, y, z,
  material: 'steel',
  // Sovrascritture locali (opzionali)
  localDensity: 7850,        // override densità (es. materiale composito localizzato)
  localTemperature: 25,       // °C, per simulazioni termiche
  localStress: 0,             // Pa, caricato da simulazione FEM
  localStrain: 0,             // Deformazione ε
  fillCoefficient: 0.8,       // compressione locale del materiale
  damage: 0.0,                // 0 = integro, 1 = rotto
  moduleId: 3,                // appartiene al modulo con id=3
}
```

---

### ⏳ FASE 6 — Simulazioni Fisiche [DA INIZIARE]

#### 6.1 Stress Analysis (FEM semplificato)

Input: griglia voxel + materiali → Output: mappa di stress per voxel.

```
Per ogni voxel:
  1. Identifica facce esposte → forze applicate su quei voxel
  2. Calcola tensore di stress locale σ
  3. Propaga stress ai voxel adiacenti
  4. Confronta σ con σ_yield del materiale → danno locale
```

File: `src/stress-analysis.js`

#### 6.2 Simulazione Termica

```
∇·(k∇T) + Q = ρcp ∂T/∂t

Input:
  - k (thermalConductivity) per ogni voxel/materiale
  - Temperatura iniziale e condizioni al contorno
  - Sorgenti di calore (puntuali o diffuse)

Output:
  - Mappa temperatura per voxel
  - Gradiente termico
  - Rilascio calore (heat dissipation)
```

File: `src/thermal-sim.js` (la base esiste già in `physics-calc.js:180`)

#### 6.3 Aerodinamica Superficiale

Input: mesh esportata → calcolo superficie esposta al flusso:

| Proprietà | Calcolo |
|---|---|
| Superficie frontale | Proiezione mesh su piano perpendicolare alla direzione del vento |
| Coefficiente di resistenza Cd | Da tabella forma + Reynolds number stimato |
| Forza di resistenza | `Fd = 0.5 × ρ × v² × Cd × A_front` |
| Portanza (di base) | `Fl = 0.5 × ρ × v² × Cl × A_top` |

File: `src/aerodynamics.js` (nuovo)

#### 6.4 Firma Fisica dell'Oggetto

Output aggregato di tutte le simulazioni:

```javascript
const signature = {
  geometria:    { volume, superficie, boundingBox },
  massa:        { totale, distribuzione, centroMassa, inerzia },
  termica:      { conducibilitàMedia, capacitàTermica, dissipazione },
  strutturale:  { stressMassimo, zonaCritica, fattoreSicurezza },
  aerodinamica: { Cd, Cl, A_frontale, forze },
  materiale:    { composizione, massaPerMateriale, densitaMedia },
};
```

---

### ⏳ FASE 7 — Motore AI [DA INIZIARE]

#### 7.1 Depth Estimation da Immagini

Input: immagine RGB 2D → Output: depth map + mesh approssimato.

```
Pipeline:
  Immagine 2D
    ↓
  MiDaS / ZoeDepth (PyTorch → ONNX.js o API Python)
    ↓
  Depth Map (pixel → profondità)
    ↓
  PCD (Point Cloud Depth)
    ↓
  Voxel Grid (depth → voxel occupancy)
    ↓
  Mesh (Marching Cubes)
```

#### 7.2 Segmentazione Oggetti

Input: immagine → Output: maschere per ogni oggetto riconosciuto.

```
SAM (Segment Anything Model) di Meta
  → Oggetti isolati
  → Ogni oggetto → depth map separata
  → Ogni oggetto → voxel grid separato
  → Assemblaggio nella scena principale
```

#### 7.3 Procedural Rule Generation da Immagini

L'AI **NON genera direttamente mesh**. Genera **regole**:

```
Immagine di un'auto
  ↓
Vision Transformer → riconosce "cofano", "ruota", "portiere"
  ↓
Per ogni parte: genera regola procedurale
  cofano  → ESTRUSIONE profilo=curva_alare, altezza=0.4, materiale=steel
  ruota   → RIVOLUZIONE profilo=cerchio, raggi=5, raggi=14, materiale=alluminio
  portiera → PIATTAFORMA rettangolo, altezza=1.2, materiale=steel
  ↓
Voxel Reconstruction → geometria finale
```

**Vantaggi rispetto a generazione mesh diretta:**
- Parametrico: puoi modificare "altezza cofano" e la geometria si adatta
- Leggero: salvi regole, non milioni di triangoli
- Componibile: parti riutilizzabili (ruota, bullone, motore)

#### 7.4 Stack AI previsto

| Modulo | Tecnologia | Stato |
|---|---|---|
| Depth Estimation | MiDaS v3 / ZoeDepth (ONNX) | ⏳ Non iniziato |
| Segmentazione oggetti | SAM (Meta) | ⏳ Non iniziato |
| Vision + classificazione | Vision Transformer PyTorch | ⏳ Non iniziato |
| Generazione regole | regole custom + LLM API | ⏳ Non iniziato |
| Inference runtime | ONNX.js (browser) / Ollama | ⏳ Non iniziato |

---

### ⏳ FASE 8 — Video Reconstruction [DA INIZIARE]

Strategia: non salvare frame/mesh, ma **keyframe + trasformazioni**.

```
Video input
   ↓
  Estrattore keyframe (cambio camera / cambio scena / intervallo 30s)
   ↓
  Per ogni keyframe:
    oggetto → regole parametriche
    camera → trasformazione (pos, rot, zoom)
   ↓
  Timeline: { keyframe1: {regole: ..., camera: ...}, keyframe2: ... }
   ↓
  Riproduzione: ricostruisci scena + applica trasformazioni interpolate
```

---

## 5. Roadmap tecnologica

```
FASE 1 ✅ Completata
   Motore voxel base, materiali, fisica base, export OBJ/STL

FASE 2 ✅ Completata
   Editor 3D interattivo, UI, undo/redo, salvataggio progetto

FASE 3 ✅ Completata (base)
    Chunk/Sparse storage ✅
    Marching Cubes completo ✅
    LOD dinamico ✅ (LODManager)
    GPU Compute 🔲

FASE 4 ✅ Completata (base)
    Procedural Rule Engine ✅ (ProceduralEngine)
    Editor di regole procedurali 🔲
    Operazioni booleane 🔲

FASE 5 ✅ Completata (base)
    Sfere → coefficiente di riempimento materia ✅
    Tetraedri → FEM element ✅
    Metadati materiale estesi ✅ (fillCoefficient, friction, fatigue, thermal)
    Proprietà locali voxel 🔲

FASE 6 ✅ Completata (base)
    Stress analysis (FEM) ✅ (StressAnalysis.js)
    Simulazione termica ✅ (già in physics-calc.js)
    Aerodinamica superficiale 🔲
    Firma fisica oggetto 🔲

FASE 7 ⏳ — Da iniziare
   AI: Depth estimation
   AI: Segmentazione oggetti
   AI: Procedural Rule Generation

FASE 8 ⏳ — Da iniziare
   Video: keyframe extraction
   Video: trasformazioni interpolate
   Video: timeline playback
```

---

## 6. Task correnti e prossime milestone

### Ora (Fase 3 in corso)

- [x] Raycasting robustness (bugground plane + faceNormal)
- [x] InstancedMesh + frustum culling guard
- [x] Chunk System: integrato `chunks Map<String, Chunk>` in voxel-engine.js
- [ ] Chunk caricamento dinamico in base camera

### Questa settimana

- [x] Marching Cubes algoritmo completo (sostituisce `_simpleCubes`)
- [x] Sfere: `SphereSystem.js` — voxel → sfere con `fillCoefficient`
- [x] Tetraedri: `TetrahedralMesh.js` — cubo → 5 tetraedri

### Prossima settimana

- [ ] Fase 4: `ProceduralEngine.js` — regole CUBO/LINEA/SIMMETRIA
- [ ] Fase 5 estesa: metadati materiale (rugosità, attrito, porosità, coefficiente espansione)
- [ ] Fisica: stress analysis per voxel

### Future

- [ ] Fase 6: FEM solver (Poisson equation / Simplified Finite Differences)
- [ ] Fase 7: MiDaS in browser via ONNX.js → depth → voxel
- [ ] Fase 8: keyframe extraction da video upload

---

*Ultimo aggiornamento: 2026-05-16*  
*Repository: github.com/ballales1984-wq/pro.cardesign*
