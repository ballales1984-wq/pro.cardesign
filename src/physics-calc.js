/**
 * PhysicsCalc — Calcoli fisici su voxel e moduli
 *
 * Calcola:
 *  - Massa totale e per modulo
 *  - Centro di massa
 *  - Volume
 *  - Inerzia semplificata
 *  - Distribuzione carichi
 */

export class PhysicsCalc {
  constructor(materialDB, moduleSystem) {
    this.materialDB = materialDB;
    this.moduleSystem = moduleSystem;
  }

  /**
   * Calcola la massa di un singolo voxel
   * @param {Object} voxel - dati voxel { material, density, ... }
   * @param {number} [voxelVolume=1] - volume del singolo voxel in unità³
   * @returns {number} massa in kg (o unità arbitrarie)
   */
  voxelMass(voxel, voxelVolume = 1) {
    const mat = this.materialDB.get(voxel.material);
    if (!mat) return 0;
    // Densità in kg/m³, ma per semplicità usiamo unità relative
    // 1 voxel = 1 unità³, la densità è scalata come kg/unità³
    // Per un modello real-scale: density * voxelVolume
    // Qui usiamo un fattore di scala per rendere i numeri gestibili
    const scale = 0.001; // 1 unità = 1mm → 1m³ = 10^9 voxel³
    return mat.density * voxelVolume * scale;
  }

  /**
   * Calcola peso (forza gravitazionale) di un voxel
   */
  voxelWeight(voxel) {
    return this.voxelMass(voxel) * 9.81;
  }

  /**
   * Calcola le proprietà aggregate di tutti i voxel
   * @param {Array} voxels - array di oggetti voxel
   * @returns {Object} risultati fisici
   */
  calculateAllVoxels(voxels) {
    if (!voxels || voxels.length === 0) {
      return this._emptyResult();
    }

    let totalMass = 0;
    let centerOfMass = { x: 0, y: 0, z: 0 };
    let totalVolume = 0;
    let inertia = { xx: 0, yy: 0, zz: 0 };

    for (const v of voxels) {
      const m = this.voxelMass(v);
      totalMass += m;
      totalVolume += 1; // 1 unità³ per voxel

      centerOfMass.x += v.x * m;
      centerOfMass.y += v.y * m;
      centerOfMass.z += v.z * m;

      // Inerzia semplificata (asse paralleli al centro)
      inertia.xx += m * (v.y * v.y + v.z * v.z);
      inertia.yy += m * (v.x * v.x + v.z * v.z);
      inertia.zz += m * (v.x * v.x + v.y * v.y);
    }

    if (totalMass > 0) {
      centerOfMass.x /= totalMass;
      centerOfMass.y /= totalMass;
      centerOfMass.z /= totalMass;
    }

    // Distribuzione materiali
    const materialDist = {};
    for (const v of voxels) {
      if (!materialDist[v.material]) {
        materialDist[v.material] = { count: 0, mass: 0 };
      }
      const vm = this.voxelMass(v);
      materialDist[v.material].count++;
      materialDist[v.material].mass += vm;
    }

    return {
      voxelCount: voxels.length,
      totalMass: this._round(totalMass, 4),
      totalVolume: this._round(totalVolume, 2),
      density: totalVolume > 0 ? this._round(totalMass / totalVolume, 4) : 0,
      centerOfMass: {
        x: this._round(centerOfMass.x, 3),
        y: this._round(centerOfMass.y, 3),
        z: this._round(centerOfMass.z, 3),
      },
      inertia: {
        xx: this._round(inertia.xx, 6),
        yy: this._round(inertia.yy, 6),
        zz: this._round(inertia.zz, 6),
      },
      materialDistribution: materialDist,
      weight: this._round(totalMass * 9.81, 4),
    };
  }

  /**
   * Calcola fisica per un modulo specifico
   */
  calculateModule(moduleId, voxelEngine) {
    const voxels = this.moduleSystem.getVoxelsForModule(moduleId, voxelEngine);
    const result = this.calculateAllVoxels(voxels);
    result.moduleName = this.moduleSystem.get(moduleId)?.name || 'Sconosciuto';
    return result;
  }

  /**
   * Calcola fisica per l'intero veicolo
   */
  calculateVehicle(voxelEngine) {
    const allVoxels = Array.from(voxelEngine.voxels.values());
    return this.calculateAllVoxels(allVoxels);
  }

  /**
   * Calcola la densità dato massa e volume
   */
  static densityFromMassVolume(mass, volume) {
    if (volume === 0) return 0;
    return mass / volume;
  }

  /**
   * Calcola la massa dato densità e volume
   * m = ρ × V
   */
  static massFromDensityVolume(density, volume) {
    return density * volume;
  }

  /**
   * Calcola il volume dato massa e densità
   * V = m / ρ
   */
  static volumeFromMassDensity(mass, density) {
    if (density === 0) return 0;
    return mass / density;
  }

  /**
   * Confronta materiali per un pezzo
   * Suggerisce il materiale più leggero che soddisfa i requisiti
   */
  suggestMaterial(minStrength, maxWeight) {
    const candidates = [];
    for (const mat of this.materialDB.getAll()) {
      if (mat.tensileStrength >= minStrength) {
        const mass = mat.density * 1; // volume unitario
        if (!maxWeight || mass <= maxWeight) {
          candidates.push({
            material: mat.name,
            label: mat.label,
            density: mat.density,
            strength: mat.tensileStrength,
            massPerVoxel: this._round(mass, 4),
            costPerKg: mat.costPerKg,
          });
        }
      }
    }
    candidates.sort((a, b) => a.massPerVoxel - b.massPerVoxel);
    return candidates;
  }

  /**
   * Analisi termica semplificata
   */
  thermalAnalysis(voxels, ambientTemp = 293, heatSourceTemp = 500) {
    if (!voxels || voxels.length === 0) return null;

    let totalConductivity = 0;
    let totalHeatCapacity = 0;

    for (const v of voxels) {
      const mat = this.materialDB.get(v.material);
      if (mat) {
        totalConductivity += mat.thermalConductivity;
        totalHeatCapacity += mat.specificHeat * this.voxelMass(v);
      }
    }

    const avgConductivity = totalConductivity / voxels.length;
    const avgHeatCapacity = totalHeatCapacity / voxels.length;

    return {
      avgThermalConductivity: this._round(avgConductivity, 3),
      avgSpecificHeat: this._round(avgHeatCapacity / (totalHeatCapacity > 0 ? voxels.length : 1), 2),
      maxTemperature: heatSourceTemp,
      deltaT: heatSourceTemp - ambientTemp,
      heatDissipationRate: this._round(avgConductivity * voxels.length * 0.01, 3),
    };
  }

  _emptyResult() {
    return {
      voxelCount: 0,
      totalMass: 0,
      totalVolume: 0,
      density: 0,
      centerOfMass: { x: 0, y: 0, z: 0 },
      inertia: { xx: 0, yy: 0, zz: 0 },
      weight: 0,
      materialDistribution: {},
    };
  }

  _round(val, decimals) {
    return Math.round(val * Math.pow(10, decimals)) / Math.pow(10, decimals);
  }
}