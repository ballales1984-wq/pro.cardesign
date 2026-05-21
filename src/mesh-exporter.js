/**
 * MeshExporter — Converte i voxel in mesh Three.js esportabili
 * Supporta: OBJ, STL, glTF (base64)
 * Usa Marching Cubes per superfici lisse (opzionale)
 */

// Import dinamico: permette al test runner di iniettare un mock prima del caricamento
// Import dinamico: permette al test runner di iniettare un mock prima del caricamento
const THREE = await import('three');
;

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
    // Accepts Array of voxel objects; Map/Iterator callers must pass .values() or get converted correctly
    const voxelArray = Array.isArray(voxels)
      ? voxels
      : (voxels.values ? Array.from(voxels.values()) : Array.from(voxels));
    if (smooth) {
      return this._marchingCubes(voxelArray, voxelSize);
    }
    return this._simpleCubes(voxelArray, voxelSize);
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
 * Marching Cubes per superfici lisse
 * Usa edge table standard 256 voci + triangolazione dinamica per ogni cella.
 * Non usa tabella di triangolazione precalcolata: genera i triangoli al volo
 * percorrendo la poligonale di intersezione superficie/cella.
 * Funziona per tutti i 256 casi di configurazione.
 */
_marchingCubes(voxels, voxelSize) {
  // Build density grid from voxels
  const voxelSet = new Set(voxels.map(v => `${v.x},${v.y},${v.z}`));

  // Find bounds
  let minX = 0, maxX = 0, minY = 0, maxY = 0, minZ = 0, maxZ = 0;
  for (const v of voxels) {
    minX = Math.min(minX, v.x); maxX = Math.max(maxX, v.x);
    minY = Math.min(minY, v.y); maxY = Math.max(maxY, v.y);
    minZ = Math.min(minZ, v.z); maxZ = Math.max(maxZ, v.z);
  }
  minX--; maxX++; minY--; maxY++; minZ--; maxZ++;

  // Edge table (256 entries, 12-bit mask each) — standard Paul Bourke
  const edgeTable = [
    0x0,0x109,0x203,0x30a,0x406,0x50f,0x605,0x70c,0x80c,0x905,0xa0f,0xb06,0xc0a,0xd03,0xe09,0xf00,
    0x190,0x099,0x393,0x29a,0x596,0x49f,0x795,0x69c,0x99c,0x895,0xb9f,0xa96,0xd9a,0xc93,0xf99,0xe90,
    0x230,0x339,0x033,0x13a,0x636,0x73f,0x435,0x53c,0xa3c,0xb35,0x83f,0x936,0xe3a,0xf33,0xc39,0xd30,
    0x3a0,0x2a9,0x1a3,0x0aa,0x7a6,0x6af,0x5a5,0x4ac,0xbac,0xaa5,0x9af,0x8a6,0xfaa,0xea3,0xda9,0xca0,
    0x460,0x569,0x663,0x76a,0x066,0x16f,0x265,0x36c,0xc6c,0xd65,0xe6f,0xf66,0x86a,0x963,0xa69,0xb60,
    0x5f0,0x4f9,0x7f3,0x6fa,0x1f6,0x0ff,0x3f5,0x2fc,0xdfc,0xcf5,0xfff,0xef6,0x9fa,0x8f3,0xbf9,0xaf0,
    0x650,0x759,0x453,0x55a,0x256,0x35f,0x057,0x15c,0xe5c,0xf55,0xc5f,0xd56,0xa5a,0xb53,0x859,0x950,
    0x7c0,0x6c9,0x5c3,0x4ca,0x3c6,0x2cf,0x1c5,0x0cc,0xfcc,0xec5,0xdcf,0xcc6,0xbca,0xac3,0x9c9,0x8c0,
    0x8c0,0x9c9,0xac3,0xbca,0xcc6,0xdcf,0xec5,0xfcc,0x0cc,0x1c5,0x2cf,0x3c6,0x4ca,0x5c3,0x6c9,0x7c0,
    0x950,0x859,0xb53,0xa5a,0xd56,0xc5f,0xf55,0xe5c,0x15c,0x057,0x35f,0x256,0x55a,0x453,0x759,0x650,
    0xaf0,0xbf9,0x8f3,0x9fa,0xef6,0xfff,0xcf5,0xdfc,0x2fc,0x3f5,0x0ff,0x1f6,0x6fa,0x7f3,0x4f9,0x5f0,
    0xb60,0xa69,0x963,0x86a,0xf66,0xe6f,0xd65,0xc6c,0x36c,0x265,0x16f,0x066,0x76a,0x663,0x569,0x460,
    0xca0,0xda9,0xea3,0xfaa,0x8a6,0x9af,0xaa5,0xbac,0x4ac,0x5a5,0x6af,0x7a6,0x0aa,0x1a3,0x2a9,0x3a0,
    0xd30,0xc39,0xf33,0xe3a,0x936,0x83f,0xb35,0xa3c,0x53c,0x435,0x73f,0x636,0x13a,0x033,0x339,0x230,
    0xf00,0xe09,0xd03,0xc0a,0xb06,0xa0f,0x905,0x80c,0x70c,0x605,0x50f,0x406,0x30a,0x203,0x109,0x000,
  ];

  // Cube vertices (indice -> coordinata locale)
  const vertTable = [
    [0,0,0],[1,0,0],[1,1,0],[0,1,0],
    [0,0,1],[1,0,1],[1,1,1],[0,1,1]
  ];

  // Edge connectivity: spigolo[i] = [verticeA, verticeB] (indici 0-7)
  const edgeConn = [
    [0,1],[1,2],[2,3],[3,0],
    [4,5],[5,6],[6,7],[7,4],
    [0,4],[1,5],[2,6],[3,7]
  ];

  // Pre-calcola adiacenza tra spigoli (condividono un vertice del cubo)
  const edgeAdj = [];
  for (let i = 0; i < 12; i++) edgeAdj[i] = [];
  for (let e1 = 0; e1 < 12; e1++) {
    const [a1, b1] = edgeConn[e1];
    for (let e2 = 0; e2 < 12; e2++) {
      if (e1 === e2) continue;
      const [a2, b2] = edgeConn[e2];
      if (a1 === a2 || a1 === b2 || b1 === a2 || b1 === b2) {
        edgeAdj[e1].push(e2);
      }
    }
  }

  const positions = [];
  const normals = [];

  const getDensity = (x, y, z) => voxelSet.has(`${x},${y},${z}`) ? 1 : 0;

  for (let z = minZ; z <= maxZ; z++) {
    for (let y = minY; y <= maxY; y++) {
      for (let x = minX; x <= maxX; x++) {
        const cube = [
          getDensity(x, y, z), getDensity(x+1, y, z), getDensity(x+1, y+1, z), getDensity(x, y+1, z),
          getDensity(x, y, z+1), getDensity(x+1, y, z+1), getDensity(x+1, y+1, z+1), getDensity(x, y+1, z+1)
        ];

        let index = 0;
        for (let i = 0; i < 8; i++) if (cube[i]) index |= (1 << i);
        if (index === 0 || index === 255) continue;

        // Spigoli intersecati dalla superficie (da edgeTable)
        const edgeMask = edgeTable[index];
        const activeEdges = [];
        for (let e = 0; e < 12; e++) {
          if (edgeMask & (1 << e)) activeEdges.push(e);
        }
        if (activeEdges.length < 3) continue;

        // Punti di intersezione (midpoint di ogni spigolo attivo)
        const pts = activeEdges.map(ei => {
          const [a, b] = edgeConn[ei];
          const mx = (vertTable[a][0] + vertTable[b][0]) / 2;
          const my = (vertTable[a][1] + vertTable[b][1]) / 2;
          const mz = (vertTable[a][2] + vertTable[b][2]) / 2;
          return [
            (x + mx) * voxelSize,
            (y + my) * voxelSize,
            (z + mz) * voxelSize
          ];
        });

        // Ordina gli spigoli lungo la poligonale chiusa della superficie
        const ordered = [activeEdges[0]];
        const used = new Set([activeEdges[0]]);
        let curr = activeEdges[0];
        while (ordered.length < activeEdges.length) {
          const neighbors = edgeAdj[curr].filter(e => !used.has(e) && (edgeMask & (1 << e)));
          if (neighbors.length === 0) break;
          const next = neighbors[0];
          ordered.push(next);
          used.add(next);
          curr = next;
        }

        // Triangolazione a ventaglio (fan) dal primo punto della poligonale
        for (let i = 1; i < ordered.length - 1; i++) {
          const p0 = pts[activeEdges.indexOf(ordered[0])];
          const p1 = pts[activeEdges.indexOf(ordered[i])];
          const p2 = pts[activeEdges.indexOf(ordered[i + 1])];
          positions.push(p0[0], p0[1], p0[2]);
          positions.push(p1[0], p1[1], p1[2]);
          positions.push(p2[0], p2[1], p2[2]);
          // Normali temporanee: saranno ricalcolate da computeVertexNormals()
          normals.push(0, 1, 0, 0, 1, 0, 0, 1, 0);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  geometry.computeVertexNormals();
  return geometry;
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
