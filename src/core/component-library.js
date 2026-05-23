/**
 * ComponentLibrary - Gestisce la libreria di componenti parametrici
 */

// Import static: permette al test runner di iniettare un mock prima del caricamento
import * as THREE from 'three';

export class ComponentInstance {
    constructor(id, definitionId, name, position, rotation = { x: 0, y: 0, z: 0 }, parameterOverrides = {}, materialOverride = null) {
        this.id = id;
        this.definition_id = definitionId;
        this.name = name;
        this.position = position; // {x, y, z} in mm
        this.rotation = rotation; // {x, y, z} in degrees
        this.parameter_overrides = parameterOverrides;
        this.material_override = materialOverride;
        this.created_by = 'user';
    }

    getParameters(definition) {
        const params = { ...definition.parameters };
        for (const [key, value] of Object.entries(this.parameter_overrides)) {
            if (params[key]) {
                params[key] = { ...params[key], value };
            }
        }
        return params;
    }
}

export class ComponentLibrary {
  constructor() {
    this.components = [];
    this.categories = {
      wheels: { label: 'Ruote', icon: '' },
      frame: { label: 'Telaio', icon: '' },
      interior: { label: 'Interno', icon: '' },
      body: { label: 'Carrozzeria', icon: '' },
      misc: { label: 'Altro', icon: '' }
    };

    this._loadDefaults();
  }

  _loadDefaults() {
     // Road Wheel 700c
     this.components.push({
       id: 1,
       name: 'Ruota Strada 700c',
       type: 'wheel',
       category: 'wheels',
       icon: '',
       color: '#333',
       description: 'Ruota strada 700c con pneumatico 30mm',
       parameters: {
         outer_radius: { value: 350, min: 300, max: 400, unit: 'mm' },
         inner_radius: { value: 311, min: 280, max: 340, unit: 'mm' },
         width: { value: 30, min: 15, max: 50, unit: 'mm' },
         rim_width: { value: 21, min: 15, max: 30, unit: 'mm' }
       }
     });

     // 2x4 Brick
     this.components.push({
       id: 100,
       name: 'Mattoncino 2x4',
       type: 'brick',
       category: 'misc',
       icon: '',
       color: '#ff0000',
       description: 'Mattoncino LEGO stile 2x4',
       parameters: {
         width: { value: 8, min: 4, max: 16, unit: 'mm' },
         height: { value: 9.6, min: 4, max: 20, unit: 'mm' },
         depth: { value: 16, min: 4, max: 32, unit: 'mm' }
       }
     });

     // MTB Wheel 29"
     this.components.push({
       id: 2,
       name: 'Ruota MTB 29"',
       type: 'wheel',
       category: 'wheels',
       icon: '',
       color: '#555',
       description: 'Ruota MTB 29" con pneumatico 2.35"',
       parameters: {
         outer_radius: { value: 380, min: 350, max: 420, unit: 'mm' },
         inner_radius: { value: 305, min: 280, max: 330, unit: 'mm' },
         width: { value: 60, min: 40, max: 80, unit: 'mm' },
         rim_width: { value: 30, min: 20, max: 40, unit: 'mm' }
       }
     });

     // Top Tube
     this.components.push({
       id: 10,
       name: 'Top Tube',
       type: 'tube',
       category: 'frame',
       icon: '',
       color: '#aaa',
       description: 'Tubo orizzontale telaio',
       parameters: {
         length: { value: 500, min: 200, max: 800, unit: 'mm' },
         diameter: { value: 28.6, min: 20, max: 40, unit: 'mm' },
         wall_thickness: { value: 1.5, min: 0.5, max: 3, unit: 'mm' }
       }
     });

     // Down Tube
     this.components.push({
       id: 11,
       name: 'Down Tube',
       type: 'tube',
       category: 'frame',
       icon: '',
       color: '#bbb',
       description: 'Tubo inclinato telaio',
       parameters: {
         length: { value: 420, min: 250, max: 600, unit: 'mm' },
         diameter: { value: 31.8, min: 25, max: 45, unit: 'mm' },
         wall_thickness: { value: 1.5, min: 0.5, max: 3, unit: 'mm' }
       }
     });

     // Seat Tube
     this.components.push({
       id: 12,
       name: 'Seat Tube',
       type: 'tube',
       category: 'frame',
       icon: '',
       color: '#ccc',
       description: 'Tubo reggisella',
       parameters: {
         length: { value: 450, min: 300, max: 600, unit: 'mm' },
         diameter: { value: 31.6, min: 25, max: 45, unit: 'mm' },
         wall_thickness: { value: 1.5, min: 0.5, max: 3, unit: 'mm' }
       }
     });

     console.log(`[ComponentLibrary] Loaded ${this.components.length} components`);
  }

  get(id) {
    return this.components.find(c => c.id === id);
  }

  getAll() {
    return [...this.components];
  }

  getByCategory(category) {
    return this.components.filter(c => c.category === category);
  }

  getByType(type) {
    return this.components.filter(c => c.type === type);
  }

  search(query) {
    const q = query.toLowerCase();
    return this.components.filter(c =>
      c.name.toLowerCase().includes(q) ||
      c.description.toLowerCase().includes(q)
    );
  }

  getCategories() {
    const result = {};
    for (const [key, cat] of Object.entries(this.categories)) {
      result[key] = {
        ...cat,
        count: this.components.filter(c => c.category === key).length
      };
    }
    return result;
  }

  createInstance(id, position, parameterOverrides = {}, materialOverride = null) {
    const definition = this.get(id);
    if (!definition) return null;

    const instanceId = Math.max(0, ...this.instances?.map(i => i.id) || [0]) + 1;
    const instance = new ComponentInstance(
      instanceId,
      id,
      `${definition.name} @ (${Math.round(position.x)},${Math.round(position.y)},${Math.round(position.z)})`,
      position,
      { x: 0, y: 0, z: 0 },
      parameterOverrides,
      materialOverride
    );

    if (!this.instances) this.instances = [];
    this.instances.push(instance);
    return instance;
  }

  getInstances() {
    return this.instances || [];
  }
}

export default ComponentLibrary;