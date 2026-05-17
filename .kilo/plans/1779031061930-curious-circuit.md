# Recovery Plan: Fix voxel-engine.js — restore orphan-module cleanup in optimize()

## Problem Summary

The `src/voxel-engine.js` file was in the middle of a partial refactoring when editing became fragmented. Analysis of the full git history shows:

- **Top-level commit:** `cbe7896` (Finish C++ FemSolver) — working but with `this.modules` (undefined bug)
- **WIP/stash (`9272c3f`):** "Stable base from yesterday" — a merge commit fixing `optimize()` to use `this.moduleSystem.modules`, but it was never committed to main

Three distinct damage types in the working copy:
1. **Missing orphan-module cleanup in `optimize()`** — the orphan-module cleanup section (present in stash `9272c3f`) was dropped, leaving `optimize()` with only the `keyToInstance` stale-ref cleanup. This is the functional regression.
2. **Inconsistent indentation** — ~20+ methods with wrong leading whitespace (3, 4, 5, 7, 9 spaces instead of 8). Cosmetic only; does NOT produce SyntaxError.
3. **Minor logic changes** — ghost position y change, update magic numbers, e.stopPropagation(), chunk key cleanup all intentionally edited.

**Key confirmations:**
- `node -c src/voxel-engine.js` exits 0 — no SyntaxError
- `acorn --module` parses successfully
- `import('./src/voxel-engine.js')` resolves → `OK [ 'VoxelEngine' ]`
- Python tests 36/36 ✅, JS tests 47/47 ✅

## Environment

| Item | Value |
|------|-------|
| OS | win32 |
| Node | 24.11.1 |
| Branch | main |
| HEAD commit | `cbe7896` |
| WIP/stash (stable base) | `stash@{0}` → commit `9272c3f` |
| Working-tree M files | `main.js`, `src/main.js`, `src/material-system.js`, `src/voxel-engine.js` |

## Root Cause

User says "stable base yesterday, broken today". The `stash@{0}` (commit `9272c3f`, timestamp "Sun May 17 12:38:39 2026") was the last save of the working state before it was left as a merge commit. The working-tree version is the least-parent of that merge (`cbe7896`) with ONLY half the WIP changes applied — most critically, the `optimize()` orphan-module cleanup from `9272c3f` was dropped.

`optimize()` at HEAD called `this.modules` — which is **never set** on the instance (only `this.moduleSystem` is set in the constructor). The WIP stash correctly used `this.moduleSystem.modules`. The working copy uses neither orphan-module cleanup.

## What NOT to Change

- `this.moduleSystem = moduleSystem;` (constructor) — keep as-is
- JS tests must remain 0 failures
- PYTHON tests must remain 0 failures
- Do NOT restore the HEAD `optimize()` version with `this.modules` — it is buggy (property does not exist)

## Steps

### 0. Verify the property exists (read-only)

```bash
grep -n "modules" src/module-system.js | head -10
# Expected: this.modules or modules property exists on the ModuleSystem class
```

### 1. Restore `optimize()` from WIP (`9272c3f`)

Replace lines **871–886** of `src/voxel-engine.js` with:

```js
    /**
     * Esegue pulizia completo:
     * - Rimuove moduli orfani (voci senza voxel o _deleted)
     * - Ripristina activeModule se il modulo attivo è stato rimosso
     * - Pulisce keyToInstance da riferimenti stale
     */
    optimize() {
      // Rimuovi moduli orfani o marcati _deleted
      const modules = this.moduleSystem.modules;
      const deadModules = Object.keys(modules).filter(
        name => !modules[name] || modules[name]._deleted
      );
      for (const name of deadModules) {
        const mod = modules[name];
        if (mod && mod.voxels) {
          for (const v of mod.voxels) {
            v.module = null; // riassegna a nessun modulo
          }
        }
        delete modules[name];
      }

      // Se activeModule non esiste più, scegli il primo disponibile
      if (this.activeModule && !(this.activeModule in modules)) {
        const remaining = Object.keys(modules);
        this.activeModule = remaining.length > 0 ? remaining[0] : null;
      }

      // Pulisci keyToInstance da voxel non più presenti (verifica su chunk)
      for (const [mat, instMap] of this.keyToInstance) {
        for (const key of Array.from(instMap.keys())) {
          const [x, y, z] = key.split(',').map(Number);
          const chunkKey = this._getChunkKey({ x, y, z });
          const chunk = this.chunks.get(chunkKey);
          const hasVoxel = chunk ? chunk.hasVoxel(x, y, z) : false;
          if (!hasVoxel) {
            instMap.delete(key);
          }
        }
      }

      this._onVoxelChanged();
    }
```

### 2. Verify syntax still passes + run tests

```bash
node -c src/voxel-engine.js          # exit 0
python -m pytest tests/test_coverage.py -v    # 36 passed
node tests/test_coverage.js                   # 47 passed
```

### 3. Git

```bash
git add src/voxel-engine.js
git commit -m "fix(voxel-engine): restore orphan-module cleanup in optimize()

The middle-of-session WIP commit (9272c3f, 'WIP stable base') contained a
correct optimize() that delegated orphan-module resolution to
this.moduleSystem.modules. Between HEAD (cbe7896) and that WIP commit the
orphan-module section was dropped from optimize(), leaving only the
keyToInstance stale-reference cleanup.

This commit restores the full orphan-module section:
- modules marked _deleted have their voxels .module reset to null
- activeModule falls back to the first remaining module if its target was deleted
- stale keyToInstance entries verified against chunk.hasVoxel()

JS tests 47/47 pass, Python tests 36/36 pass.
Refs: stash@{0}, commit 9272c3f"
```
