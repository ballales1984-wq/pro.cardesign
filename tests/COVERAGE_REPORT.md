# Test Coverage Report — pro.cardesign
Data: 2026-05-15 | build: v0.3.0

## Sommario

| Lingua | Test passati | Test totali | Coverage |
|--------|-------------|-------------|----------|
| Python | 23 | 23 | 65% (core) |
| JavaScript | 4 | 4 | N/A (test strutturali) |
| **Totale** | **27** | **27** | ✅ |

---

## Python Coverage (`pytest` + `pytest-cov`)

### Dettaglio per file

```
core/__init__.py         2      0   100%
core/brick.py           46      0   100%  ← Completamente coperto
core/component.py       78     11    86%
core/bike_demo.py       18     18     0%  (demo, non testato)
core/test_brick.py      34     34     0%  (test stesso)
```

**TOTALE core: 178 righe | 63 non coperte | 65%**

### Test Python passati (23/23)

| Categoria | Test | Risultato |
|-----------|------|-----------|
| Brick | `test_brick_creation` | ✅ |
| Brick | `test_volume_calculation` | ✅ |
| Brick | `test_center_calculation` | ✅ |
| Brick | `test_max_corner` | ✅ |
| Brick | `test_contains_point` | ✅ |
| Brick | `test_overlaps_true` | ✅ |
| Brick | `test_overlaps_false` | ✅ |
| Helper | `test_create_cube` | ✅ |
| Helper | `test_create_bar_x/y/z` | ✅ |
| Helper | `test_create_wheel_tire` | ✅ |
| ID Counter | `test_next_id_increments` | ✅ |
| Component | `test_library_has_defaults` | ✅ |
| Component | `test_get_by_id` | ✅ |
| Component | `test_get_by_category` | ✅ |
| Component | `test_get_by_type` | ✅ |
| Component | `test_search` | ✅ |
| Component | `test_save_and_load_custom` | ✅ |
| Component | `test_component_instance` | ✅ |
| Physics | `test_mass_calculation` | ✅ |
| Physics | `test_com_calculation` | ✅ |
| Physics | `test_save_load_json` | ✅ |

---

## JavaScript Coverage (Node.js)

### Dettaglio

| Modulo | Test | Risultato |
|--------|------|-----------|
| MaterialSystem | `8 materials, get, addCustom, duplicate prevention` | ✅ |
| ModuleSystem | `create, assign, tree, remove` | ✅ |
| Brick (JS) | `constructor, volume, BrickSystem init` | ✅ |
| ComponentLibrary | `5 defaults, getById, search` | ✅ |

**Totale JS: 4/4 passati**

### Come eseguire
```bash
node tests/test_coverage.js
```

---

## Build Status
```
npm run build  ✅  16 moduli | 77.2 kB JS
```

---

## Copertura Codice per Funzionalità

### ✅ Completamente testato
- [x] `core/brick.py` — Creatore, dimensioni, overlap, centro, volume
- [x] `core/__init__.py` — Importazioni
- [x] MaterialSystem JS — Database materiali, densità, massa voxel
- [x] ModuleSystem JS — Creazione moduli, gerarchia, rimozione
- [x] Brick JS — Costruttore, proprietà, BrickSystem instancing

### 🟡 Parzialmente testato
- [~] `core/component.py` — Libreria componenti cercata (11% righe non coperte: edge cases save/load)
- [~] qualità analyzer — Logica importata in `stl-import.js` non coperta da test JS strutturale
- [~] `physics-calc.js` — Dipende da VoxelEngine JS (non mockato completamente)

### 🔴 Non testato
- [ ] STLImporter (parser ASCII, fitToScene)
- [ ] ScalingTool JS (dipendente da VoxelEngine)
- [ ] UI layout (CSS/DOM)
- [ ] Aerodinamica (non implementata)

---

## Azioni Raccomandate

1. **Porta `component.py` all'86% → 95%+** (testare `get_by_type`, `save_custom` con path assoluti)
2. **Aggiungi test per `mesh-exporter.js`** (OBJ/STL generation)
3. **Mock VoxelEngine per testare `physics-calc.js`** in isolation
4. **Aggiungi integration test end-to-end** per save/carica progetto