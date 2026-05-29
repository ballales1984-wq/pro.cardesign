# Documento Tecnico — Architettura Sistema Voxel Procedurale AI

## Progetto

**Motore 3D ibrido:**
- voxel
- procedurale
- parametrico
- AI-assisted

**Ispirato a:**
- CAD parametrici
- engine voxel
- generatori AI 3D
- sistemi procedural

---

## 1. Obiettivo del progetto

Creare un software capace di:

- modellare strutture 3D tramite voxel
- associare dati fisici ai voxel
- generare mesh automatiche
- utilizzare regole procedurali invece di geometria completa
- integrare AI per interpretazione immagini/video
- ottimizzare memoria e performance

---

## 2. Filosofia del sistema

Il sistema **NON** salva:

- milioni di triangoli
- voxel completi permanenti

Il sistema salva principalmente:

- regole
- parametri
- trasformazioni spaziali
- riferimenti modulari

La geometria viene:

- generata runtime
- ricostruita dinamicamente
- convertita in mesh solo quando necessario

---

## 3. Architettura generale

```
INPUT (sketch / immagine / video / comandi)
        ↓
AI INTERPRETATION LAYER
        ↓
PROCEDURAL RULE ENGINE
        ↓
SPATIAL VOXEL CORE
        ↓
SURFACE EXTRACTION
        ↓
MESH OPTIMIZATION
        ↓
REALTIME RENDERER
        ↓
EXPORT OBJ / GLTF / STL
```

---

## 4. Core concettuale

### 4.1 Sistema voxel intelligente

Ogni voxel può contenere:

| Proprietà | Descrizione |
|---|---|
| materiale | acciaio, carbonio, plastica |
| densità | massa volumica |
| temperatura | simulazione termica |
| attrito | simulazione superfici |
| rigidità | resistenza |
| pressione | simulazioni fluidi |
| funzione | motore, telaio, ala |
| tolleranza | precisione produttiva |

---

## 5. Sistema procedurale

### Concetto fondamentale

**NON** memorizzare:

- voxel singoli
- mesh finale

**MA:**

- istruzioni costruttive

### 5.1 Esempi regole procedurali

```
LINEA lunghezza=6 asse=X
CUBO dimensioni=20x30x10
ESTRUSIONE altezza=50
SIMMETRIA asse=X
```

### 5.2 Albero operazioni

Il sistema mantiene uno storico parametrico:

```
Sketch
 ├── Estrusione
 ├── Curva
 ├── Foro
 ├── Smusso
 └── Simmetria
```

---

## 6. Sistema spaziale

### 6.1 Coordinate

Ogni elemento viene definito tramite:

| Parametro | Funzione |
|---|---|
| posizione | coordinate XYZ |
| rotazione | orientamento |
| scala | dimensione |
| parent | gerarchia |

### 6.2 Scene Graph

Sistema gerarchico:

```
Auto
 ├── Telaio
 ├── Ruota_FL
 ├── Ruota_FR
 ├── Motore
 └── Ala
```

---

## 7. Compressione memoria

### Problema

I voxel puri richiedono memoria enorme.

### 7.1 Soluzioni adottate

- **Sparse Voxel Storage** — salvare solo voxel occupati
- **Chunk System** — divisione spazio in blocchi caricabili dinamicamente
- **Instancing** — riutilizzo moduli identici
  - es. ruote, bulloni, motori
- **Procedural Reconstruction** — salvataggio regole invece di geometria

---

## 8. Pipeline geometrica

```
Regole Procedurali
        ↓
Voxel Generator
        ↓
Sparse Spatial Grid
        ↓
Marching Cubes
        ↓
Mesh
        ↓
Retopology
        ↓
Rendering
```

---

## 9. Surface Extraction

### Metodo principale: Marching Cubes

Conversione: voxel → mesh triangolare

**Vantaggi:** veloce, semplice, compatibile GPU

---

## 10. Rendering

### Tecnologie previste

| Tecnologia | Funzione |
|---|---|
| OpenGL | rendering realtime |
| ModernGL | gestione GPU |
| Open3D | visualizzazione mesh |
| Vulkan (futuro) | performance avanzate |

---

## 11. Modulo AI

### 11.1 Obiettivi

L'AI **NON genera direttamente mesh finali**.

L'AI genera:

- regole
- profondità
- strutture
- suggerimenti geometrici

### 11.2 Pipeline AI

```
Immagine / Video
        ↓
Vision Transformer
        ↓
Depth Estimation
        ↓
Object Segmentation
        ↓
Procedural Rule Generation
        ↓
Voxel Reconstruction
```

### 11.3 Tecnologie AI

| Modulo | Tecnologia |
|---|---|
| Visione | PyTorch |
| Segmentazione | SAM |
| Depth | MiDaS |
| AI 3D | PyTorch3D |
| Diffusion | HuggingFace |

---

## 12. Gestione video

### Strategia

**NON** salvare:

- tutti i frame
- tutte le mesh

**MA:**

- keyframe
- trasformazioni
- variazioni spaziali

---

## 13. Struttura dati consigliata

```python
class ProceduralObject:
    type
    parameters
    transform
    children
    material
```

---

## 14. Motore voxel

### Grid virtuale

```
voxels[x][y][z]
```

- Solo voxel attivi: allocati dinamicamente, caricati a chunk

---

## 15. Ottimizzazioni future

- **GPU Compute** — uso shader compute:
  - voxel generation
  - marching cubes
  - simulazioni
- **Nanite-like System** — LOD dinamici: distanza camera, dettaglio adattivo
- **Streaming** — caricamento progressivo spazio 3D

---

## 16. Possibili applicazioni

| Settore | Applicazione |
|---|---|
| automotive | concept car |
| robotica | simulazioni |
| CAD | prototipazione |
| gaming | mondi voxel |
| aerodinamica | studio superfici |
| stampa 3D | produzione |
| domotica | simulazione ambienti |

---

## 17. Stack software consigliato

| Funzione | Libreria |
|---|---|
| GUI | PyQt6 |
| Vision | OpenCV |
| AI | PyTorch |
| Voxel | NumPy |
| Mesh | Open3D |
| Compressione | Octree |
| Rendering | ModernGL |
| Export | Trimesh |

---

## 18. Roadmap sviluppo

### Fase 1 — Editor voxel base

### Fase 2 — Sistema chunk + sparse storage

### Fase 3 — Generazione mesh

### Fase 4 — Motore procedurale

### Fase 5 — Import sketch

### Fase 6 — AI depth estimation

### Fase 7 — AI rule generation

### Fase 8 — Video reconstruction

---

## 19. Visione finale

Sistema ibrido capace di:

- modellazione voxel
- geometria procedurale
- AI generativa
- simulazione fisica
- rendering realtime
- esportazione industriale

Con forte ottimizzazione su:

- memoria
- scalabilità
- modularità
- modificabilità parametrica
