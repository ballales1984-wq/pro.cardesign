/**
 * MaterialSystem — Database materiali con proprietà fisiche reali
 */
export class MaterialSystem {
  constructor() {
    this.materials = new Map();
    this._defaults();
  }

  _defaults() {
    const defaults = [
      {
        name: 'steel',
        label: 'Acciaio',
        color: 0x888888,
        density: 7850,        // kg/m³
        youngsModulus: 210e9, // Pa
        poissonRatio: 0.29,
        tensileStrength: 400e6,
        thermalConductivity: 50, // W/(m·K)
        specificHeat: 486,      // J/(kg·K)
        meltingPoint: 1530,     // °C
        costPerKg: 0.8,        // €/kg
        recyclable: true,
        roughness: 0.3,
        metalness: 0.9,
        fillCoefficient: 0.707,  // spheres touch on edge
        roughnessProfile: 'Ra=0.8μm',
        porosity: 0.0,            // 0 = compact
        fatigueLimit: 200e6,      // Pa
        thermalExpansion: 11e-6,  // 1/°C
        dampingRatio: 0.02,       // vibration damping
        magneticPermeability: 100,// relative permeability
        staticFriction: 0.74,     // μs
        kineticFriction: 0.57,    // μk
        restitution: 0.5,         // coefficient of restitution
      },
      {
        name: 'aluminum',
        label: 'Alluminio',
        color: 0xc0c0c0,
        density: 2700,
        youngsModulus: 70e9,
        poissonRatio: 0.33,
        tensileStrength: 90e6,
        thermalConductivity: 237,
        specificHeat: 897,
        meltingPoint: 660,
        costPerKg: 2.5,
        recyclable: true,
        roughness: 0.2,
        metalness: 0.85,
      },
      {
        name: 'titanium',
        label: 'Titanio',
        color: 0x87ceeb,
        density: 4500,
        youngsModulus: 116e9,
        poissonRatio: 0.32,
        tensileStrength: 880e6,
        thermalConductivity: 21.9,
        specificHeat: 520,
        meltingPoint: 1668,
        costPerKg: 15,
        recyclable: false,
        roughness: 0.25,
        metalness: 0.8,
      },
      {
        name: 'carbon_fiber',
        label: 'Fibra di Carbonio',
        color: 0x1a1a1a,
        density: 1600,
        youngsModulus: 181e9,
        poissonRatio: 0.27,
        tensileStrength: 1500e6,
        thermalConductivity: 7,
        specificHeat: 850,
        meltingPoint: 3500,
        costPerKg: 45,
        recyclable: false,
        roughness: 0.15,
        metalness: 0.1,
      },
      {
        name: 'foam',
        label: 'Schiuma (PU)',
        color: 0xf5deb3,
        density: 40,
        youngsModulus: 0.03e9,
        poissonRatio: 0.05,
        tensileStrength: 0.2e6,
        thermalConductivity: 0.03,
        specificHeat: 1200,
        meltingPoint: 200,
        costPerKg: 3,
        recyclable: false,
        roughness: 0.8,
        metalness: 0.0,
      },
      {
        name: 'rubber',
        label: 'Gomma',
        color: 0x2a2a2a,
        density: 1100,
        youngsModulus: 0.01e9,
        poissonRatio: 0.49,
        tensileStrength: 15e6,
        thermalConductivity: 0.16,
        specificHeat: 1600,
        meltingPoint: 200,
        costPerKg: 1.5,
        recyclable: true,
        roughness: 0.9,
        metalness: 0.0,
      },
      {
        name: 'glass',
        label: 'Vetro',
        color: 0x87ceeb,
        density: 2500,
        youngsModulus: 70e9,
        poissonRatio: 0.22,
        tensileStrength: 33e6,
        thermalConductivity: 1.0,
        specificHeat: 840,
        meltingPoint: 1500,
        costPerKg: 0.5,
        recyclable: true,
        roughness: 0.05,
        metalness: 0.0,
        transparent: true,
        opacity: 0.6,
      },
      {
        name: 'copper',
        label: 'Rame',
        color: 0xb87333,
        density: 8960,
        youngsModulus: 117e9,
        poissonRatio: 0.34,
        tensileStrength: 210e6,
        thermalConductivity: 401,
        specificHeat: 385,
        meltingPoint: 1085,
        costPerKg: 8,
        recyclable: true,
        roughness: 0.1,
        metalness: 1.0,
      },
    ];

    for (const m of defaults) {
      this.materials.set(m.name, m);
    }
  }

  get(name) {
    return this.materials.get(name) || null;
  }

  getAll() {
    return Array.from(this.materials.values());
  }

  getDensity(name) {
    const m = this.materials.get(name);
    return m ? m.density : 0;
  }

  count() {
    return this.materials.size;
  }

  add(material) {
    if (this.materials.has(material.name)) return false;
    this.materials.set(material.name, material);
    return true;
  }

  remove(name) {
    return this.materials.delete(name);
  }

  // Calcola massa di un voxel
  getVoxelMass(voxel) {
    const density = this.getDensity(voxel.material);
    const volume = 1e-9; // 1 voxel = 1mm³ in m³ (se voxel size = 0.001m)
    // Ma semplifichiamo: 1 voxel = 1 unità³, densità in kg/unità³
    return density * 1; // 1 unità cubica
  }

  // Calcola peso (forza gravitazionale)
  getVoxelWeight(voxel) {
    return this.getVoxelMass(voxel) * 9.81;
  }
}