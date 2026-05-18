/**
 * TetrahedralMesh - Decomposes voxel grid into tetrahedra for FEM simulation
 * Each cube is decomposed into 5 tetrahedra (MacNeal's decomposition)
 */
// Import dinamico: permette al test runner di iniettare un mock prima del caricamento
const THREE = await import('three');
;

export class Tetrahedron {
  constructor(v0, v1, v2, v3, material) {
    this.vertices = [v0, v1, v2, v3];
    this.material = material;
    this.stress = 0;
    this.strain = 0;
  }

  getVolume() {
    const [a, b, c, d] = this.vertices;
    const ab = [b[0]-a[0], b[1]-a[1], b[2]-a[2]];
    const ac = [c[0]-a[0], c[1]-a[1], c[2]-a[2]];
    const ad = [d[0]-a[0], d[1]-a[1], d[2]-a[2]];
    
    const cross = [
      ac[1]*ad[2] - ac[2]*ad[1],
      ac[2]*ad[0] - ac[0]*ad[2],
      ac[0]*ad[1] - ac[1]*ad[0]
    ];
    
    const dot = ab[0]*cross[0] + ab[1]*cross[1] + ab[2]*cross[2];
    return Math.abs(dot) / 6;
  }

  getCentroid() {
    return this.vertices.reduce((sum, v) => [
      sum[0] + v[0],
      sum[1] + v[1], 
      sum[2] + v[2]
    ], [0, 0, 0]).map(x => x / 4);
  }

  toJSON() {
    return {
      vertices: this.vertices,
      material: this.material,
      stress: this.stress,
      strain: this.strain
    };
  }
}

export class TetrahedralMesh {
  constructor(voxelSize = 1.0) {
    this.voxelSize = voxelSize;
    this.tetrahedra = [];
  }

  /**
   * Decompose a single voxel into 5 tetrahedra
   * Using MacNeal's decomposition:
   *   T1: 0,1,2,4  T2: 0,2,3,4  T3: 0,3,7,4
   *   T4: 0,7,6,4  T5: 0,6,5,4
   */
  decomposeVoxel(voxel) {
    const x = voxel.x * this.voxelSize;
    const y = voxel.y * this.voxelSize;
    const z = voxel.z * this.voxelSize;
    const s = this.voxelSize;
    
    const v0 = [x, y, z];
    const v1 = [x+s, y, z];
    const v2 = [x+s, y+s, z];
    const v3 = [x, y+s, z];
    const v4 = [x, y, z+s];
    const v5 = [x+s, y, z+s];
    const v6 = [x+s, y+s, z+s];
    const v7 = [x, y+s, z+s];
    
    const tetIndices = [
      [0, 1, 2, 4], [0, 2, 3, 4], [0, 3, 7, 4],
      [0, 7, 6, 4], [0, 6, 5, 4]
    ];
    
    const vertices = [v0, v1, v2, v3, v4, v5, v6, v7];
    
    for (const indices of tetIndices) {
      this.tetrahedra.push(new Tetrahedron(
        vertices[indices[0]],
        vertices[indices[1]],
        vertices[indices[2]],
        vertices[indices[3]],
        voxel.material
      ));
    }
  }

  /**
   * Decompose all voxels into tetrahedra
   */
  buildFromVoxels(voxels) {
    this.tetrahedra = [];
    for (const voxel of voxels) {
      this.decomposeVoxel(voxel);
    }
    return this.tetrahedra;
  }

  /**
   * Calculate strain from displacement vector
   * For each tetrahedron: ε = B * u
   */
  calculateStrain(displacements) {
    // Simplified strain calculation
    for (const tet of this.tetrahedra) {
      tet.strain = this._computeTetraStrain(tet, displacements);
    }
  }

  _computeTetraStrain(tet, displacements) {
    // Simplified: return average displacement difference
    return 0.001; // placeholder
  }

  /**
   * Calculate stress from strain: σ = E * ε
   */
  calculateStress() {
    for (const tet of this.tetrahedra) {
      const E = this._getYoungsModulus(tet.material);
      tet.stress = E * tet.strain;
    }
  }

  _getYoungsModulus(material) {
    const moduli = {
      steel: 200e9,
      aluminum: 70e9,
      titanium: 116e9,
      carbon: 150e9,
      glass: 70e9,
      rubber: 0.01e9,
      foam: 0.01e6,
      copper: 117e9
    };
    return moduli[material] ?? 70e9;
  }

  /**
   * Get tetrahedra in a bounding box
   */
  getTetrahedraInBounds(min, max) {
    return this.tetrahedra.filter(tet => {
      const c = tet.getCentroid();
      return c[0] >= min.x && c[0] <= max.x &&
             c[1] >= min.y && c[1] <= max.y &&
             c[2] >= min.z && c[2] <= max.z;
    });
  }

  /**
   * Generate Three.js mesh for visualization
   */
  createMesh(visibleTets = null) {
    const geometry = new THREE.BufferGeometry();
    const positions = [];
    const indices = [];
    
    const tets = visibleTets ?? this.tetrahedra;
    for (const tet of tets) {
      for (const v of tet.vertices) {
        positions.push(v[0], v[1], v[2]);
      }
      const base = (positions.length / 3) - 4;
      indices.push(
        base, base+1, base+2,
        base, base+2, base+3
      );
    }
    
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    
    return new THREE.Mesh(
      geometry,
      new THREE.MeshStandardMaterial({
        color: 0x00d2ff,
        wireframe: true,
        transparent: true,
        opacity: 0.4
      })
    );
  }

  /**
   * Get statistics
   */
  getStats() {
    const totalVolume = this.tetrahedra.reduce((sum, t) => sum + t.getVolume(), 0);
    const stressRange = this.tetrahedra.reduce((r, t) => ({
      min: Math.min(r.min, t.stress),
      max: Math.max(r.max, t.stress)
    }), { min: Infinity, max: -Infinity });
    
    return {
      tetraCount: this.tetrahedra.length,
      totalVolume,
      stressMin: stressRange.min === Infinity ? 0 : stressRange.min,
      stressMax: stressRange.max === -Infinity ? 0 : stressRange.max
    };
  }

  toJSON() {
    return {
      tetrahedra: this.tetrahedra.map(t => t.toJSON()),
      voxelSize: this.voxelSize
    };
  }

  fromJSON(data) {
    this.voxelSize = data.voxelSize ?? 1.0;
    this.tetrahedra = (data.tetrahedra ?? []).map(t => {
      const tet = new Tetrahedron(t.vertices[0], t.vertices[1], t.vertices[2], t.vertices[3], t.material);
      tet.stress = t.stress;
      tet.strain = t.strain;
      return tet;
    });
    return this;
  }
}