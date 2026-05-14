# Voxel CAD Intelligente - Piano di Sviluppo

## Obiettivo
Software dove i voxel sono unità di fisica reale, editor 3D desktop con Electron + Three.js.

## Fasi

### FASE 1 - Motore Voxel Base [COMPLETATO]
- Griglia 3D con rendering Three.js
- Voxel con proprietà fisiche (materiale, densità, temperatura, danno)
- Sistema modulare gerarchico
- Calcolo massa, centro di massa, inerzia
- Salvataggio/caricamento JSON
- Esportazione mesh OBJ/STL

### FASE 2 - Editor 3D [COMPLETATO]
- Interfaccia Electron + Three.js
- Click per piazzare/rimuovere voxel
- Selezione materiale
- Undo/Redo
- Pannelli laterali (materiali, moduli, proprietà, fisica)

### FASE 3 - Performance & Ottimizzazione [IN CORSO]
- Migrazione a InstancedMesh per rendering massivo
- Marching Cubes per superfici lisce
- LOD (Level of Detail) dinamico
- Caching e frustum culling avanzato

### FASE 4 - Simulazione Fisica Avanzata
- Stress analysis strutturale
- Simulazione termica
- Gravity e collision detection
- Animazione e simulazione in tempo reale