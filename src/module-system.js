/**
 * ModuleSystem — Sistema gerarchico per organizzare voxel in moduli funzionali
 *
 * Struttura ad albero:
 *   Veicolo
 *   ├── Telaio
 *   │   ├── Longherone anteriore
 *   │   └── Longherone posteriore
 *   ├── Carrozzeria
 *   │   ├── Cofano
 *   │   ├── Parafango
 *   │   └── Portiera
 *   └── Aerodinamica
 *       ├── Ala anteriore
 *       └── Diffusore
 */

let _idCounter = 0;
function nextId() { return ++_idCounter; }

export class Module {
  constructor(name, parentId = null) {
    this.id = nextId();
    this.name = name;
    this.parentId = parentId;
    this.childIds = [];
    this.voxelKeys = [];      // riferimenti diretti ai voxel nella griglia
    this.properties = {
      tolerance: 0.1,
      targetWeight: null,    // kg
      minStiffness: null,
      maxStress: null,
    };
    this.metadata = {
      color: '#888888',
      icon: '📦',
      locked: false,
      visible: true,
    };
  }
}

export class ModuleSystem {
  constructor(materialDB) {
    this.materialDB = materialDB;
    this.modules = new Map();
    this.rootId = null;
    this.nextModuleId = nextId;

    // Crea root automatico
    this.createRoot('Veicolo');
  }

  // ── Creazione ──────────────────────────────────────────────
  createRoot(name) {
    const mod = new Module(name);
    this.modules.set(mod.id, mod);
    this.rootId = mod.id;
    return mod.id;
  }

  createModule(name, parentId = null) {
    const parent = parentId ? this.modules.get(parentId) : null;
    if (parentId && !parent) return null;

    const mod = new Module(name, parentId);
    this.modules.set(mod.id, mod);

    if (parent) {
      parent.childIds.push(mod.id);
    }

    if (!parentId && this.rootId !== null) {
      // Diventa figlio del root di default
      const root = this.modules.get(this.rootId);
      if (root) root.childIds.push(mod.id);
    }

    return mod.id;
  }

  // ── Assegnazione voxel a modulo ─────────────────────────────
  assignVoxelToModule(voxelKey, moduleId) {
    const mod = this.modules.get(moduleId);
    if (!mod) return false;

    if (!mod.voxelKeys.includes(voxelKey)) {
      mod.voxelKeys.push(voxelKey);
    }

    return true;
  }

  unassignVoxel(voxelKey, moduleId) {
    const mod = this.modules.get(moduleId);
    if (!mod) return false;

    const idx = mod.voxelKeys.indexOf(voxelKey);
    if (idx !== -1) {
      mod.voxelKeys.splice(idx, 1);
    }
    return true;
  }

  // Rimuovi un modulo e tutti i suoi figli
  removeModule(moduleId) {
    const mod = this.modules.get(moduleId);
    if (!mod) return false;

    // Rimuovi ricorsivamente figli
    for (const childId of [...mod.childIds]) {
      this.removeModule(childId);
    }

    // Rimuovi dal parent
    if (mod.parentId) {
      const parent = this.modules.get(mod.parentId);
      if (parent) {
        const idx = parent.childIds.indexOf(moduleId);
        if (idx !== -1) parent.childIds.splice(idx, 1);
      }
    }

    this.modules.delete(moduleId);
    return true;
  }

  // ── Query ───────────────────────────────────────────────────
  get(moduleId) {
    return this.modules.get(moduleId) || null;
  }

  getAll() {
    return Array.from(this.modules.values());
  }

  getChildren(moduleId) {
    const mod = this.modules.get(moduleId);
    if (!mod) return [];
    return mod.childIds.map(id => this.modules.get(id)).filter(Boolean);
  }

  getTree(moduleId = null) {
    const root = moduleId ? this.modules.get(moduleId) : this.modules.get(this.rootId);
    if (!root) return null;
    return this._buildTree(root);
  }

  _buildTree(mod) {
    return {
      id: mod.id,
      name: mod.name,
      voxelCount: mod.voxelKeys.length,
      icon: mod.metadata.icon,
      color: mod.metadata.color,
      visible: mod.metadata.visible,
      locked: mod.metadata.locked,
      properties: { ...mod.properties },
      children: mod.childIds
        .map(id => this.modules.get(id))
        .filter(Boolean)
        .map(child => this._buildTree(child)),
    };
  }

  getVoxelsForModule(moduleId, voxelEngine) {
    const mod = this.modules.get(moduleId);
    if (!mod) return [];
    return mod.voxelKeys.map(key => {
      const [x, y, z] = key.split(',').map(Number);
      return voxelEngine.getVoxelAt(x, y, z);
    }).filter(Boolean);
  }

  count() {
    return this.modules.size;
  }

  // ── Persistenza ─────────────────────────────────────────────
  toJSON() {
    return {
      rootId: this.rootId,
      modules: Array.from(this.modules.entries()).map(([id, m]) => ({
        id: m.id,
        name: m.name,
        parentId: m.parentId,
        childIds: m.childIds,
        voxelKeys: m.voxelKeys,
        properties: m.properties,
        metadata: m.metadata,
      })),
    };
  }

  fromJSON(data) {
    this.modules.clear();
    _idCounter = 0;

    if (!data || !data.modules) return;

    for (const m of data.modules) {
      const mod = Object.assign(new Module(''), m);
      this.modules.set(mod.id, mod);
      if (mod.id > _idCounter) _idCounter = mod.id;
    }

    this.rootId = data.rootId;
  }
}