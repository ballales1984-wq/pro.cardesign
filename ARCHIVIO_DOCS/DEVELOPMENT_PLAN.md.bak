# VoxelCAD — Piano di Sviluppo e Stato Attuale

## Proprietà del Sistema

| Strato | Stato |
|---|---|
| Input (sketch, immagini, comandi) | In pianificazione (Fase 7+) |
| AI Interpretation Layer | Non iniziato |
| Procedural Rule Engine | Non iniziato |
| Spatial Voxel Core | **Parzialmente implementato** |

## Obiettivo
Modellare strutture 3D tramite voxel, associare dati fisici, generare mesh automatiche, e applicare regole parametriche/inferite da AI.

## Stato delle Fasi

### ✅ FASE 1 — Motore Voxel Base [COMPLETATO]

Vedi `src/voxel-engine.js`, `src/material-system.js`, `src/module-system.js`.

- Griglia 3D con rendering Three.js
- Materiali con proprietà fisiche reali (acciaio, alluminio, titanio, carbonio, ecc.)
- Gerarchia moduli funzionali (Telaio, Carrozzeria, Ala, ecc.)
- Calcolo massa, centro di massa, inerzia, distribuzione materiali
- Salvataggio/caricamento JSON (voxel + moduli)
- Esportazione mesh **OBJ** e **STL** (binario e ASCII)

**Bug corretti in `src/voxel-engine.js`**:
| Bug | Fix |
|---|---|
| Ground plane esclusa dal frustum culling | `groundPlane.frustumCulled = false` |
| `intersectObject` senza guard `recursive` | `intersectObject(groundPlane, false)` |
| `hit.faceNormal` può essere `null` | Fallback `{x:0,y:0,z:1}` sicuro |
| Highlight non aggiornato su voxel hit | Highlight sempre aggiornato in `_onPointerMove` |
| `needsUpdate` non impostato su nuove istanze | `mesh.count = instanceId + 1` dopo aggiunta |

### ✅ FASE 2 — Editor 3D [COMPLETATO]

- Strumenti: Seleziona (V), Aggiungi (A), Rimuovi (R), Fill livello (F), Ridimensiona mattoni (Shift+Click)
- Selezione materiale da palette (8 materiali predefiniti + custom)
- Click per piazzare/rimuovere voxel con preview ghost + highlight
- Undo / Redo (50 passi)
- Pannelli laterali: Materiali, Moduli (albero gerarchico), Proprietà voxel, Fisica
- Simulazione fisica click-to-run: massa, CoM, inerzia, distribuzione materiali
- Salvataggio/Caricamento progetti JSON
- Esportazione mesh da interfaccia
- Visualizzazione dimensioni in tempo reale per mattoni selezionati
- Ridimensionamento mattoni basato sulla normale della faccia (simile allo strumento di ridimensionamento libero)

### ⚡ FASE 3 — Ottimizzazione Performance [IN CORSO]

- [x] InstancedMesh: 1 draw call per materiale invece che 1 per voxel
- [ ] Marching Cubes: da _simpleCubes a algoritmo completo
- [ ] LOD dinamico basato su distanza camera
- [ ] Chunk System + Sparse Voxel Storage
- [ ] Frustum culling avanzato

### ⏳ FASE 4 — Simulazione Fisica Avanzata [DA INIZIARE]

- [ ] Stress analysis strutturale (distribuzione stress per modulo)
- [ ] Simulazione termica (conducibilità, capacità termica per materiale)
- [ ] Gravity e collision detection con Physijs/Ammo.js
- [ ] Animazione e simulazione in tempo reale

### ⏳ FASE 5 — Import Sketch/2D [DA INIZIARE]

- [ ] Parsing SVG come input voxel
- [ ] Depth estimation da silhouette 2D
- [ ] Estrusione parametrica da schizzo

### ⏳ FASE 6 — AI Depth Estimation [DA INIZIARE]

- [ ] Integrazione MiDaS / ZoeDepth
- [ ] Conversione immagine → depth map
- [ ] Depth map → griglia voxel

### ⏳ FASE 7 — AI Rule Generation [DA INIZIARE]

- [ ] Segmentazione oggetti (SAM)
- [ ] Vision Transformer per classificazione parti
- [ ] Generazione regole procedurali da immagine/video

### ⏳ FASE 8 — Video Reconstruction [DA INIZIARE]

- [ ] Keyframe extraction
- [ ] Trasformazioni spaziali interpolate
- [ ] Nessun salvataggio di frame o mesh complete

## Problemi Noti

### 🐛 js2c C++ Binding — Electron Fails on `require('electron')`

**Sintomi**:  
```
TypeError: Cannot read properties of undefined (reading 'whenReady')
  at main.js:27:5
  at c._load (electron/js2c/node_init:2:NNNN)
```

**Diagnosi**: `require('electron')` nella fase di inizializzazione js2c restituisce il percorso del binario come stringa invece dell'oggetto API. Il binding C++ per il modulo `electron` non viene iniettato nel contesto `main.js` prima che esso venga eseguito.

**Occorre**:  
Questo è un problema noto anche di Electron v42.1.0 (Node Vite 2025).  
Si verifica quando il processo Node.js di sistema non riesce a inizializzare i binding C++ durante il caricamento di Electron.

**Workaround**:  
- Esegui il frontend direttamente nel browser: `npm run dev` (Vite risponde su http://localhost:5176)  
- Verifica che non ci siano versioni di Node.js multiple in PATH:  
  ```powershell
  # Rimuovi versioni conflittuali
  where.exe node
  # Installazione pulita
  rmdir /s node_modules && npm install
  ```

## Stack Software

| Layer | Libreria |
|---|---|
| GUI | Electron (v42 / v28) + Vite |
| 3D | Three.js r167 |
| Rendering | WebGL (ModernGL-like via Three.js) |
| AI (prev.) | PyTorch → ONNX.js nel browser |
| Mesh Export | Custom OBJ/STL writer |
| Physics | Custom (PhysicsCalc) |
| Storage | JSON + Sparse Map interna |
| Build | Vite 5 |

## Workflow di Sviluppo

```powershell
# Sviluppo (solo frontend Vite, funziona sempre)
npm run dev

# Build produzione (funziona)
npm run build

# Avvio Electron desktop (richiede Electron C++)
npm start   # o npx electron .

# Solo Vite (senza Electron, per testing veloce)
npx vite --port 5176 --strictPort
```
