# Test Coverage Report — pro.cardesign
Date: 2026-05-15 | build: v0.3.0

## Summary

| Language | Tests Passed | Total Tests | Coverage |
|----------|-------------|-------------|----------|
| Python | 23 | 23 | 65% (core) |
| JavaScript | 4 | 4 | N/A (structural tests) |
| **Total** | **27** | **27** | ✅ |

---

## Python Coverage (`pytest` + `pytest-cov`)

### Detail per file

```
core/__init__.py         2      0   100%
core/brick.py           46      0   100%  ← Fully covered
core/component.py       78     11    86%
core/bike_demo.py       18     18     0%  (demo, not tested)
core/test_brick.py      34     34     0%  (test itself)
```

**TOTAL core: 178 lines | 63 not covered | 65%**

### Passed Python Tests (23/23)

| Category | Test | Result |
|----------|------|--------|
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

### Detail

| Module | Test | Result |
|--------|------|--------|
| MaterialSystem | `8 materials, get, addCustom, duplicate prevention` | ✅ |
| ModuleSystem | `create, assign, tree, remove` | ✅ |
| Brick (JS) | `constructor, volume, BrickSystem init` | ✅ |
| ComponentLibrary | `5 defaults, getById, search` | ✅ |

**Total JS: 4/4 passed**

### How to run
```bash
node tests/test_coverage.js
```

---

## Build Status
```
npm run build  ✅  16 modules | 77.2 kB JS
```

---

## Code Coverage by Functionality

### ✅ Fully Tested
- [x] `core/brick.py` — Creator, dimensions, overlap, center, volume
- [x] `core/__init__.py` — Imports
- [x] MaterialSystem JS — Materials database, density, voxel mass
- [x] ModuleSystem JS — Module creation, hierarchy, removal
- [x] Brick JS — Constructor, properties, BrickSystem instancing

### 🟡 Partially Tested
- [~] `core/component.py` — Component library searched (11% lines not covered: edge cases save/load)
- [~] quality analyzer — Logic imported in `stl-import.js` not covered by JS structural test
- [~] `physics-calc.js` — Depends on VoxelEngine JS (not fully mocked)

### 🔴 Not Tested
- [ ] STLImporter (ASCII parser, fitToScene)
- [ ] ScalingTool JS (dependent on VoxelEngine)
- [ ] UI layout (CSS/DOM)
- [ ] Aerodynamics (not implemented)

---

## Recommended Actions

1. **Bring `component.py` from 86% → 95%+** (test `get_by_type`, `save_custom` with absolute paths)
2. **Add tests for `mesh-exporter.js`** (OBJ/STL generation)
3. **Mock VoxelEngine to test `physics-calc.js`** in isolation
4. **Add end-to-end integration test** for save/load project