/**
 * SphereSystem - Converts voxel data to spheres with fillCoefficient
 * Represents material with natural porosity via sphere packing
 */
// Import dinamico: permette al test runner di iniettare un mock prima del caricamento
const THREE = await import('three');
;

export class Sphere {
  constructor(x, y, z, radius, material, fillCoefficient = 0.707) {
    this.x = x;
    this.y = y;
    this.z = z;
    this.radius = radius;
    this.material = material;
    this.fillCoefficient = fillCoefficient;
  }

  toJSON() {
    return {
      x: this.x,
      y: this.y,
      z: this.z,
      radius: this.radius,
      material: this.material,
      fillCoefficient: this.fillCoefficient
    };
  }

  static fromJSON(data) {
    return new Sphere(data.x, data.y, data.z, data.radius, data.material, data.fillCoefficient);
  }
}

export class SphereSystem {
  constructor(voxelSize = 1.0) {
    this.voxelSize = voxelSize;
    this.spheres = [];
  }

  /**
   * Convert voxel to sphere representation
   * @param {Object} voxel - {x, y, z, material}
   * @param {number} fillCoefficient - R / voxelSize ratio (0.707 = dense, 0.5 = porous)
   */
  voxelToSphere(voxel, fillCoefficient = 0.707) {
    const radius = (this.voxelSize / 2) * fillCoefficient;
    return new Sphere(
      voxel.x * this.voxelSize + this.voxelSize / 2,
      voxel.y * this.voxelSize + this.voxelSize / 2,
      voxel.z * this.voxelSize + this.voxelSize / 2,
      radius,
      voxel.material,
      fillCoefficient
    );
  }

  /**
   * Convert array of voxels to spheres
   * @param {Array} voxels - Array of voxel objects
   * @param {Object} materialFillMap - Map of material -> fillCoefficient
   */
  voxelsToSpheres(voxels, materialFillMap = {}) {
    this.spheres = [];
    for (const voxel of voxels) {
      const fillCoeff = materialFillMap[voxel.material] ?? 0.707;
      this.spheres.push(this.voxelToSphere(voxel, fillCoeff));
    }
    return this.spheres;
  }

  /**
   * Calculate effective material properties considering porosity
   * @param {string} materialName - material key
   * @param {number} fillCoefficient - porosity factor
   */
  getEffectiveDensity(materialName, fillCoefficient) {
    const material = this.getMaterialProperty(materialName, 'density');
    const porosity = 1 - (fillCoefficient / 0.707);
    return material * (1 - porosity * 0.3);
  }

  getMaterialProperty(materialName, property) {
    const defaults = {
      steel: { density: 7850, youngsModulus: 200e9, poissonRatio: 0.3 },
      aluminum: { density: 2700, youngsModulus: 70e9, poissonRatio: 0.33 },
      titanium: { density: 4500, youngsModulus: 116e9, poissonRatio: 0.34 },
      carbon: { density: 1600, youngsModulus: 150e9, poissonRatio: 0.2 },
      rubber: { density: 1100, youngsModulus: 0.01e9, poissonRatio: 0.49 },
      foam: { density: 50, youngsModulus: 0.01e6, poissonRatio: 0.3 },
      glass: { density: 2500, youngsModulus: 70e9, poissonRatio: 0.23 },
      copper: { density: 8960, youngsModulus: 117e9, poissonRatio: 0.34 }
    };
    return defaults[materialName]?.[property] ?? 0;
  }

  /**
   * Generate Three.js mesh from spheres (for visualization)
   */
  createSphereMesh() {
    const group = new THREE.Group();
    for (const sphere of this.spheres) {
      const geometry = new THREE.SphereGeometry(sphere.radius, 16, 12);
      const material = new THREE.MeshStandardMaterial({
        color: this.getMaterialColor(sphere.material),
        transparent: true,
        opacity: 0.6,
        depthWrite: false
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.set(sphere.x, sphere.y, sphere.z);
      group.add(mesh);
    }
    return group;
  }

  getMaterialColor(materialName) {
    const colors = {
      steel: 0x888888,
      aluminum: 0xaaaaaa,
      titanium: 0xc0c0c0,
      carbon: 0x222222,
      rubber: 0x336699,
      foam: 0xeeeeee,
      glass: 0xdddddd,
      copper: 0xb87333
    };
    return colors[materialName] ?? 0xffffff;
  }

  /**
   * Calculate porosity metrics
   */
  getPorosityStats() {
    const totalVolume = this.spheres.reduce((sum, s) => {
      return sum + (4/3) * Math.PI * Math.pow(s.radius, 3);
    }, 0);
    
    const voxelVolume = this.spheres.length * Math.pow(this.voxelSize / 2, 3) * 8;
    const porosity = voxelVolume > 0 ? 1 - (totalVolume / voxelVolume) : 0;
    
    return {
      totalVolume,
      voxelVolume,
      porosity,
      sphereCount: this.spheres.length
    };
  }

  toJSON() {
    return {
      spheres: this.spheres.map(s => s.toJSON()),
      voxelSize: this.voxelSize
    };
  }

  fromJSON(data) {
    this.voxelSize = data.voxelSize ?? 1.0;
    this.spheres = (data.spheres ?? []).map(s => Sphere.fromJSON(s));
    return this;
  }
}