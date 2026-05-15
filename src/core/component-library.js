/**
 * ComponentLibrary - Gestisce la libreria di componenti parametrici
 */

import * as THREE from 'three';

export class ComponentLibrary {
  constructor() {
    this.components = [];
    this.categories = {
      wheels: { label: 'Ruote', icon: '⚫' },
      frame: { label: 'Telaio', icon: '🔧' },
      interior: { label: 'Interno', icon: '🪑' },
      body: { label: 'Carrozzeria', icon: '🚗' },
      misc: { label: 'Altro', icon: '📦' }
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
      icon: '⚫',
      color: '#333',
      description: 'Ruota strada 700c con pneumatico 30mm',
      parameters: {
        outer_radius: { value: 350, min: 300, max: 400, unit: 'mm' },
        inner_radius: { value: 311, min: 280, max: 340, unit: 'mm' },
        width: { value: 30, min: 15, max: 50, unit: 'mm' },
        rim_width: { value: 21, min: 15, max: 30, unit: 'mm' }
      }
    });
    
    // MTB Wheel 29"
    this.components.push({
      id: 2,
      name: 'Ruota MTB 29"',
      type: 'wheel',
      category: 'wheels',
      icon: '⚫',
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
      icon: '📏',
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
      icon: '📏',
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
      icon: '📏',
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
}

export default ComponentLibrary;