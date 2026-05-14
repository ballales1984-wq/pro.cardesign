/**
 * MeshExporter — Converte i voxel in mesh Three.js esportabili
 * Supporta: OBJ, STL, glTF (base64)
 * Usa Marching Cubes per superfici lisce (opzionale)
 */

export class MeshExporter {
  constructor() {
    this._faceVertices = [];
    this._faceNormals = [];
  }

  /**
   * Converte la griglia voxel in una geometria Three.js triangolata
   * Usa il metodo "cubes" (6 facce per voxel visibile) o "marching cubes"
   */
  voxelToGeometry(voxels, voxelSize = 1.0, smooth = false) {
    if (smooth) {
      return this._marchingCubes(voxels, voxelSize);
    }
    return this._simpleCubes(voxels, voxelSize);
  }

  /**
   * Metodo semplice: un cubo per ogni voxel esposto
   * Ottimizzato: non crea facce tra voxel adiacenti
   */
  _simpleCubes(voxels, voxelSize) {
    const positions = [];
    const normals = [];
    const uvs = [];
    const indices = [];

    // Crea un set di chiavi per lookup veloce
    const voxelSet = new Set(voxels.map(v => `${v.x},${v.y},${v.z}`));

    let vertexOffset = 0;
    const half = voxelSize / 2;

    for (const voxel of voxels) {
      const cx = voxel.x * voxelSize;
      const cy = voxel.y * voxelSize;
      const cz = voxel.z * voxelSize;

      // 6 facce: +X, -X, +Y, -Y, +Z, -Z
      const faces = [
        { dir: [1,0,0],  normal: [1,0,0],  uAxis: [0,0,1], vAxis: [0,1,0] },
        { dir: [-1,0,0], normal: [-1,0,0], uAxis: [0,0,-1], vAxis: [0,1,0] },
        { dir: [0,1,0],  normal: [0,1,0],  uAxis: [1,0,0], vAxis: [0,0,1] },
        { dir: [0,-1,0], normal: [0,-1,0], uAxis: [1,0,0], vAxis: [0,0,-1] },
        { dir: [0,0,1],  normal: [0,0,1],  uAxis: [1,0,0], vAxis: [0,1,0] },
        { dir: [0,0,-1], normal: [0,0,-1], uAxis: [-1,0,0], vAxis: [0,1,0] },
      ];

      for (const face of faces) {
        const neighborKey = `${voxel.x + face.dir[0]},${voxel.y + face.dir[1]},${voxel.z + face.dir[2]}`;
        // Crea la faccia solo se il vicino non esiste (superficie esterna)
        if (voxelSet.has(neighborKey)) continue;

        const [nx, ny, nz] = face.normal;
        const [ux, uy, uz] = face.uAxis;
        const [vx, vy, vz] = face.vAxis;

        // 4 vertici della faccia
        const verts = [
          [cx - half*ux - half*vx + half*nx, cy - half*uy - half*vy + half*ny, cz - half*uz - half*vz + half*nz],
          [cx + half*ux - half*vx + half*nx, cy + half*uy - half*vy + half*ny, cz + half*uz - half*vz + half*nz],
          [cx + half*ux + half*vx + half*nx, cy + half*uy + half*vy + half*ny, cz + half*uz + half*vz + half*nz],
          [cx - half*ux + half*vx + half*nx, cy - half*uy + half*vy + half*ny, cz - half*uz + half*vz + half*nz],
        ];

        for (const v of verts) {
          positions.push(v[0], v[1], v[2]);
          normals.push(nx, ny, nz);
          uvs.push(0, 0);
        }

        const v = vertexOffset;
        indices.push(v, v+1, v+2, v, v+2, v+3);
        vertexOffset += 4;
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geometry.setIndex(indices);
    geometry.computeBoundingSphere();

    return geometry;
  }

  /**
   * Marching Cubes per superfici lisce
   * (Implementazione semplificata — dual contouring per risultati migliori)
   */
  _marchingCubes(voxels, voxelSize) {
    // Per MVP, usa simple cubes
    // In futuro: implementare marching cubes classico o dual contouring
    console.warn('Marching cubes non ancora implementato, usa simple cubes');
    return this._simpleCubes(voxels, voxelSize);
  }

  /**
   * Esporta in formato OBJ (testo)
   */
  exportOBJ(geometry, materials = []) {
    const pos = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const uv = geometry.getAttribute('uv');
    const index = geometry.getIndex();

    let obj = '# Exported from VoxelCAD\n';
    obj += `# Vertices: ${pos.count}\n`;
    obj += `o VoxelCAD_Mesh\n`;

    // Vertici
    for (let i = 0; i < pos.count; i++) {
      obj += `v ${pos.getX(i).toFixed(6)} ${pos.getY(i).toFixed(6)} ${pos.getZ(i).toFixed(6)}\n`;
    }

    // UV
    if (uv) {
      obj += `\n# UVs: ${uv.count}\n`;
      for (let i = 0; i < uv.count; i++) {
        obj += `vt ${uv.getX(i).toFixed(6)} ${uv.getY(i).toFixed(6)}\n`;
      }
    }

    // Normali
    if (normal) {
      obj += `\n# Normals: ${normal.count}\n`;
      for (let i = 0; i < normal.count; i++) {
        obj += `vn ${normal.getX(i).toFixed(6)} ${normal.getY(i).toFixed(6)} ${normal.getZ(i).toFixed(6)}\n`;
      }
    }

    // Facce
    obj += `\ng default\n`;
    if (index) {
      for (let i = 0; i < index.count; i += 3) {
        const a = index.getX(i) + 1;
        const b = index.getX(i + 1) + 1;
        const c = index.getX(i + 2) + 1;
        if (normal && uv) {
          obj += `f ${a}/${a}/${a} ${b}/${b}/${b} ${c}/${c}/${c}\n`;
        } else {
          obj += `f ${a} ${b} ${c}\n`;
        }
      }
    }

    return obj;
  }

  /**
   * Esporta in formato STL (binario o ASCII)
   */
  exportSTL(geometry, ascii = true) {
    const pos = geometry.getAttribute('position');
    const normal = geometry.getAttribute('normal');
    const index = geometry.getIndex();

    if (ascii) {
      let stl = 'solid VoxelCAD\n';
      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          const i0 = index.getX(i);
          const i1 = index.getX(i + 1);
          const i2 = index.getX(i + 2);

          const n = normal
            ? `  normal ${normal.getX(i0).toFixed(6)} ${normal.getY(i0).toFixed(6)} ${normal.getZ(i0).toFixed(6)}`
            : '  normal 0 0 0';
          stl += `facet${n}\n`;
          stl += '    outer loop\n';
          for (const idx of [i0, i1, i2]) {
            stl += `      vertex ${pos.getX(idx).toFixed(6)} ${pos.getY(idx).toFixed(6)} ${pos.getZ(idx).toFixed(6)}\n`;
          }
          stl += '    endloop\n';
          stl += '  endfacet\n';
        }
      }
      stl += 'endsolid VoxelCAD\n';
      return stl;
    } else {
      // Binario STL (80 header + 4 count + triangles)
      const triangleCount = index ? index.count / 3 : 0;
      const buffer = new ArrayBuffer(80 + 4 + triangleCount * 50);
      const view = new DataView(buffer);

      // Header (80 bytes)
      for (let i = 0; i < 80; i++) view.setUint8(i, 0);

      // Triangle count
      view.setUint32(80, triangleCount, true);

      let offset = 84;
      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          const i0 = index.getX(i);
          const i1 = index.getX(i + 1);
          const i2 = index.getX(i + 2);

          // Normal
          if (normal) {
            view.setFloat32(offset, normal.getX(i0), true); offset += 4;
            view.setFloat32(offset, normal.getY(i0), true); offset += 4;
            view.setFloat32(offset, normal.getZ(i0), true); offset += 4;
          } else {
            view.setFloat32(offset, 0); offset += 4;
            view.setFloat32(offset, 0); offset += 4;
            view.setFloat32(offset, 1); offset += 4;
          }

          // 3 vertici
          for (const idx of [i0, i1, i2]) {
            view.setFloat32(offset, pos.getX(idx), true); offset += 4;
            view.setFloat32(offset, pos.getY(idx), true); offset += 4;
            view.setFloat32(offset, pos.getZ(idx), true); offset += 4;
          }

          // Attribute byte count
          view.setUint16(offset, 0, true); offset += 2;
        }
      }

      return buffer;
    }
  }

  /**
   * Genera una mesh Three.js a partire dalla geometria
   * (per preview nel viewport prima dell'export)
   */
  createPreviewMesh(geometry, materialColor = 0x00d2ff) {
    const wireMat = new THREE.MeshStandardMaterial({
      color: materialColor,
      wireframe: true,
      transparent: true,
      opacity: 0.4,
    });
    const solidMat = new THREE.MeshStandardMaterial({
      color: materialColor,
      flatShading: true,
      metalness: 0.3,
      roughness: 0.5,
    });

    return {
      wireframe: new THREE.Mesh(geometry, wireMat),
      solid: new THREE.Mesh(geometry, solidMat),
    };
  }

  /**
   * Download helper
   */
  download(filename, content, mimeType = 'text/plain') {
    const blob = new Blob(
      [content instanceof ArrayBuffer ? content : content],
      { type: mimeType }
    );
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}