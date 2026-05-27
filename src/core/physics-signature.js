/**
 * PhysicsSignature - Aggregates all physical properties of an object
 * Combines geometry, mass, thermal, structural, and aerodynamic data
 */
export class PhysicsSignature {
  constructor(voxelEngine, materialDB, physicsCalc, stressAnalysis, aerodynamics) {
    this.voxelEngine = voxelEngine;
    this.materialDB = materialDB;
    this.physicsCalc = physicsCalc;
    this.stressAnalysis = stressAnalysis;
    this.aerodynamics = aerodynamics;
  }

  /**
   * Generate complete physics signature
   */
  generate(voxels) {
    // Geometry properties
    const geom = this._getGeometricProperties(voxels);
    
    // Mass properties
    const masses = this._getMassProperties(voxels);
    
    // Thermal properties
    const thermal = this._getThermalProperties(voxels);
    
    // Structural properties
    const stress = this.stressAnalysis?.analyze(voxels) || [];
    const structural = this._getStructuralProperties(stress);
    
    // Aerodynamic properties
    const aero = this._getAerodynamicProperties(geom, voxels);
    
    // Material composition
    const materials = this._getMaterialComposition(voxels);
    
    return {
      timestamp: Date.now(),
      version: '1.0',
      geometry: geom,
      mass: masses,
      thermal,
      structural,
      aerodynamics: aero,
      materials
    };
  }

  _getGeometry(voxels) {
    return {
      volume: voxels.length,
      surfaceArea: this._estimateSurfaceArea(voxels),
      boundingBox: this._getBoundingBox(voxels)
    };
  }

  _getGeometricProperties(voxels) {
    if (!voxels || voxels.length === 0) {
      return { volume: 0, surfaceArea: 0, boundingBox: { min: [0,0,0], max: [0,0,0] } };
    }
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    
    for (const v of voxels) {
      minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
      minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
      minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
    }
    
    return {
      volume: voxels.length,
      surfaceArea: this._estimateSurfaceArea(voxels),
      boundingBox: { min: [minX, minY, minZ], max: [maxX, maxY, maxZ] }
    };
  }

  _estimateSurfaceArea(voxels) {
    // Each exposed face contributes to surface area
    const voxelSet = new Set(voxels.map(v => `${v.x},${v.y},${v.z}`));
    let faces = 0;
    
    for (const v of voxels) {
      for (const [dx, dy, dz] of [
        [1,0,0], [-1,0,0], [0,1,0], [0,-1,0], [0,0,1], [0,0,-1]
      ]) {
        if (!voxelSet.has(`${v.x+dx},${v.y+dy},${v.z+dz}`)) {
          faces++;
        }
      }
    }
    return faces * 0.5; // Approximate
  }

  _getBoundingBox(voxels) {
    if (voxels.length === 0) return { min: [0,0,0], max: [0,0,0] };
    const x = voxels.map(v => v.x);
    const y = voxels.map(v => v.y);
    const z = voxels.map(v => v.z);
    return {
      min: [Math.min(...x), Math.min(...y), Math.min(...z)],
      max: [Math.max(...x), Math.max(...y), Math.max(...z)]
    };
  }

  _getMassProperties(voxels) {
    return {
      totalMass: this.physicsCalc?.calculateAllVoxels?.(voxels)?.totalMass || 0,
      centerOfMass: this.physicsCalc?.calculateAllVoxels?.(voxels)?.centerOfMass || [0,0,0],
      inertia: this.physicsCalc?.calculateAllVoxels?.(voxels)?.inertia || [0,0,0]
    };
  }

  _getThermalProperties(voxels) {
    return {
      conductivity: this._calculateAverageProperty(voxels, 'thermalConductivity'),
      heatCapacity: this._calculateAverageProperty(voxels, 'specificHeat')
    };
  }

   _getStructuralProperties(stressResults) {
     if (!this.stressAnalysis) {
       return { stressMassimo: 0, zonaCritica: 0, fattoreSicurezza: 0 };
     }
     
     return {
       stressMassimo: Math.max(...stressResults.map(s => s.stress), 0),
       zonaCritica: this.stressAnalysis.getCriticalZones().length,
       fattoreSicurezza: this.stressAnalysis.getSafetyFactor()
     };
   }

  _getAerodynamicProperties(geometry, voxels) {
    const frontalArea = this._estimateFrontalArea(voxels);
    return {
      frontalArea: frontalArea,
      estimatedCd: 0.3,
      estimatedCl: 0.0
    };
  }

  _estimateFrontalArea(voxels) {
    if (voxels.length === 0) return 0;
    const x = voxels.map(v => v.x);
    const y = voxels.map(v => v.y);
    const z = voxels.map(v => v.z);
    
    const dx = Math.max(...x) - Math.min(...x) + 1;
    const dz = Math.max(...z) - Math.min(...z) + 1;
    return dx * dz * 0.7; // Approximate
  }

  _calculateAverageProperty(voxels, prop) {
    if (voxels.length === 0) return 0;
    let sum = 0;
    for (const v of voxels) {
      sum += this.materialDB.get(v.material)?.[prop] ?? 0;
    }
    return sum / voxels.length;
  }

  _getMaterialComposition(voxels) {
    const counts = {};
    for (const v of voxels) {
      counts[v.material] = (counts[v.material] || 0) + 1;
    }
    return counts;
  }

  /**
   * Compare two signatures
   */
  compare(sig1, sig2) {
    return {
      massDiff: Math.abs(sig1.mass.totalMass - sig2.mass.totalMass),
      volumeDiff: Math.abs(sig1.geometry.volume - sig2.geometry.volume),
      comDiff: this._distance(sig1.mass.centerOfMass, sig2.mass.centerOfMass)
    };
  }

  _distance(a, b) {
    return Math.sqrt((a[0]-b[0])**2 + (a[1]-b[1])**2 + (a[2]-b[2])**2);
  }

  toJSON() {
    return (sig) => sig;
  }
}