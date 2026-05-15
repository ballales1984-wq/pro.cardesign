// Mock moduli per test JS
module.exports = {
  MockMaterialSystem: class {
    constructor() {
      this.materials = new Map();
      this.materials.set('steel', { name:'steel', label:'Acciaio', density:7850, youngsModulus:210e9, tensileStrength:400e6, thermalConductivity:50, specificHeat:486, meltingPoint:1530, costPerKg:0.8, recyclable:true, roughness:0.3, metalness:0.9, transparent:false, opacity:1, color:0x888888 });
      this.materials.set('carbon_fiber', { name:'carbon_fiber', label:'Carb', density:1600, youngsModulus:181e9, tensileStrength:1500e6, thermalConductivity:7, specificHeat:850, meltingPoint:3500, costPerKg:45, recyclable:false, roughness:0.15, metalness:0.1, transparent:false, opacity:1, color:0x111111 });
    }
    get(n) { return this.materials.get(n); }
    getAll() { return Array.from(this.materials.values()); }
    count() { return this.materials.size; }
  },
  MockModuleSystem: class {
    constructor() {
      this.modules = new Map();
      this.rootId = 1;
      let id = 0;
      this._nextId = () => ++id;
      this.createRoot('Veicolo');
    }
    createRoot(name) {
      this.modules.set(1, { id:1, name, parentId:null, childIds:[], voxelKeys:[], properties:{}, metadata:{ color:'#888', icon:'📦' } });
      this.rootId = 1;
      return 1;
    }
    createModule(name, parentId) { return this._nextId(); }
    get(id) { return this.modules.get(id); }
    getAll() { return Array.from(this.modules.values()); }
    assignVoxelToModule(k, m) { return true; }
    unassignVoxel(k, m) { return true; }
    removeModule(m) { return this.modules.delete(m); }
    getChildren() { return []; }
    getTree() { return { id:1, name:'Veicolo', voxelCount:0, icon:'📦', color:'#888', visible:true, locked:false, properties:{}, children:[] }; }
    getVoxelsForModule() { return []; }
    count() { return this.modules.size; }
    toJSON() { return { rootId:1, modules: [] }; }
    fromJSON() { return true; }
  }
};