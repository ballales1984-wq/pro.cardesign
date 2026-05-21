/**
 * STL Importer — Load scanned STL/OBJ files and verify fit
 */

// Import dinamico: permette al test runner di iniettare un mock prima del caricamento
// Import dinamico: permette al test runner di iniettare un mock prima del caricamento
const THREE = await import('three');
;

export class STLImporter {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
  }

  async importSTL(file) {
    const arrayBuffer = await file.arrayBuffer();
    const header = String.fromCharCode(...new Uint8Array(arrayBuffer, 0, 80));
    
    // Check if binary (first 80 bytes are text in ASCII, binary in STL binary)
    const isBinary = header.includes('\x00') || header.length < 10;
    
    if (isBinary) {
      return this.parseBinarySTL(arrayBuffer);
    }
    const text = new TextDecoder().decode(arrayBuffer);
    return this.parseASCII_STL(text);
  }

  parseBinarySTL(arrayBuffer) {
    const data = new DataView(arrayBuffer);
    const triangleCount = data.getUint32(80, true);
    
    const vertices = [];
    const normals = [];
    
    for (let i = 0; i < triangleCount; i++) {
      const offset = 84 + i * 50;
      
      const normal = new THREE.Vector3(
        data.getFloat32(offset, true),
        data.getFloat32(offset + 4, true),
        data.getFloat32(offset + 8, true)
      );
      
      for (let v = 0; v < 3; v++) {
        const vOffset = offset + 12 + v * 12;
        vertices.push(new THREE.Vector3(
          data.getFloat32(vOffset, true),
          data.getFloat32(vOffset + 4, true),
          data.getFloat32(vOffset + 8, true)
        ));
        normals.push(normal);
      }
    }
    
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(
      vertices.flatMap(v => [v.x, v.y, v.z]), 3
    ));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(
      normals.flatMap(n => [n.x, n.y, n.z]), 3
    ));
    geometry.computeBoundingSphere();
    
    return geometry;
  }

  parseASCII_STL(text) {
    // Simple ASCII STL parser
    const vertices = [];
    const normals = [];

    const lines = text.split('\n');
    let currentNormal = null;
    let currentVerts = [];

    for (const line of lines) {
      const clean = line.trim().replace(/\s+/g, ' ');
      
      if (!currentNormal && clean.startsWith('facet normal')) {
        const parts = clean.split(' ');
        currentNormal = new THREE.Vector3(
          parseFloat(parts[2]),
          parseFloat(parts[3]),
          parseFloat(parts[4])
        );
        currentVerts = [];
      } else if (currentNormal && clean.startsWith('vertex')) {
        const parts = clean.split(' ');
        currentVerts.push(new THREE.Vector3(
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3])
        ));
      } else if (clean === 'endfacet' && currentVerts.length === 3) {
        vertices.push(...currentVerts);
        normals.push(currentNormal, currentNormal, currentNormal);
        currentNormal = null;
        currentVerts = [];
      }
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(
      vertices.flatMap(v => [v.x, v.y, v.z]), 3
    ));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(
      normals.flatMap(n => [n.x, n.y, n.z]), 3
    ));
    geometry.computeBoundingSphere();

    return geometry;
  }

  async importFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'stl') {
      return this.importSTL(file);
    } else if (ext === 'obj') {
      return this.importOBJ(file);
    } else {
      throw new Error('Unsupported format: ' + ext);
    }
  }

   async importOBJ(file) {
     const text = await file.text();
     return this.parseASCII_OBJ(text);
   }

   parseASCII_OBJ(text) {
     // Simple OBJ parser - handles vertices and faces
     const vertices = [];
     const normals = [];
     const uvs = [];

     const lines = text.split('\n');
     const positions = [];
     const normalsOut = [];

     for (const line of lines) {
       const clean = line.trim();
       if (clean.startsWith('v ')) {
         // Vertex
         const parts = clean.split(' ');
         vertices.push(new THREE.Vector3(
           parseFloat(parts[1]),
           parseFloat(parts[2]),
           parseFloat(parts[3])
         ));
       } else if (clean.startsWith('vt ')) {
         // UV coordinate
         const parts = clean.split(' ');
         uvs.push(new THREE.Vector2(
           parseFloat(parts[1]),
           parseFloat(parts[2])
         ));
       } else if (clean.startsWith('vn ')) {
         // Normal
         const parts = clean.split(' ');
         normals.push(new THREE.Vector3(
           parseFloat(parts[1]),
           parseFloat(parts[2]),
           parseFloat(parts[3])
         ));
       } else if (clean.startsWith('f ')) {
         // Face
         const parts = clean.split(' ').slice(1);
         // Process triangular faces ( triangulate if needed )
         if (parts.length >= 3) {
           // For simplicity, we'll take the first three vertices of each face
           // A more robust implementation would triangulate polygonal faces
           for (let i = 0; i < Math.min(3, parts.length); i++) {
             const facePart = parts[i].split('/');
             const vertexIndex = parseInt(facePart[0]) - 1; // OBJ indices are 1-based
             const uvIndex = facePart[1] ? parseInt(facePart[1]) - 1 : undefined;
             const normalIndex = facePart[2] ? parseInt(facePart[2]) - 1 : undefined;

             if (vertexIndex >= 0 && vertexIndex < vertices.length) {
               positions.push(vertices[vertexIndex]);
               
               // Add normal if available, otherwise we'll compute later
               if (normalIndex !== undefined && normalIndex >= 0 && normalIndex < normals.length) {
                 normalsOut.push(normals[normalIndex]);
               }
             }
           }
         }
       }
     }

     // If we don't have normals from the OBJ file, compute them
     if (normalsOut.length === 0 && positions.length >= 3) {
       // Compute normals from triangle faces
       for (let i = 0; i < positions.length; i += 3) {
         if (i + 2 < positions.length) {
           const v0 = positions[i];
           const v1 = positions[i + 1];
           const v2 = positions[i + 2];
           
           const normal = new THREE.Vector3()
             .subVectors(v1, v0)
             .cross(v2.sub(v0))
             .normalize();
             
           normalsOut.push(normal, normal, normal);
         }
       }
     }

     // If we still don't have normals, use a default
     if (normalsOut.length === 0) {
       for (let i = 0; i < positions.length; i++) {
         normalsOut.push(new THREE.Vector3(0, 1, 0)); // Default up normal
       }
     }

     const geometry = new THREE.BufferGeometry();
     geometry.setAttribute('position', new THREE.Float32BufferAttribute(
       positions.flatMap(v => [v.x, v.y, v.z]), 3
     ));
     geometry.setAttribute('normal', new THREE.Float32BufferAttribute(
       normalsOut.flatMap(n => [n.x, n.y, n.z]), 3
     ));
     geometry.computeBoundingSphere();

     return geometry;
   }

  fitToScene(geometry, targetSize = 24) {
    // Resize geometry to fit targetSize (mm)
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scaleFactor = targetSize / maxDim;
    
    const scaled = geometry.clone();
    scaled.scale(scaleFactor, scaleFactor, scaleFactor);
    
    // Center on X/Z, then place the bottom on the editor ground plane.
    scaled.center();
    scaled.computeBoundingBox();
    scaled.translate(0, -scaled.boundingBox.min.y, 0);
    scaled.computeBoundingBox();
    
    return {
      geometry: scaled,
      scaleFactor,
      originalSize: size.clone(),
      bbox: bbox.clone()
    };
  }

  /**
   * Convert a fitted mesh into editable surface voxels in editor grid coordinates.
   */
  meshToVoxels(geometry, voxelSize = 1.0) {
    const positions = geometry.getAttribute('position');
    const occupied = new Set();

    const addPoint = (x, y, z) => {
      const gx = Math.round(x / voxelSize);
      const gy = Math.max(0, Math.round(y / voxelSize));
      const gz = Math.round(z / voxelSize);
      occupied.add(`${gx},${gy},${gz}`);
    };

    for (let i = 0; i < positions.count; i += 3) {
      const ax = positions.getX(i), ay = positions.getY(i), az = positions.getZ(i);
      const bx = positions.getX(i + 1), by = positions.getY(i + 1), bz = positions.getZ(i + 1);
      const cx = positions.getX(i + 2), cy = positions.getY(i + 2), cz = positions.getZ(i + 2);

      addPoint(ax, ay, az);
      addPoint(bx, by, bz);
      addPoint(cx, cy, cz);
      addPoint((ax + bx + cx) / 3, (ay + by + cy) / 3, (az + bz + cz) / 3);
    }

    return Array.from(occupied, key => {
      const [x, y, z] = key.split(',').map(Number);
      return { x, y, z, material: 'steel', scale: [1, 1, 1] };
    });
  }
}

export class QualityAnalyzer {
  analyzeGeometry(geometry, expectedDiameterMm = 600) {
    const positions = geometry.getAttribute('position');
    const vertexCount = positions.count;
    
    // Calculate centroid
    const center = new THREE.Vector3();
    for (let i = 0; i < vertexCount; i++) {
      center.x += positions.getX(i);
      center.y += positions.getY(i);
      center.z += positions.getZ(i);
    }
    center.divideScalar(vertexCount);
    
    // Distance from center for each vertex
    const distances = [];
    for (let i = 0; i < vertexCount; i++) {
      const v = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      distances.push(v.distanceTo(center));
    }
    
    const meanRadius = distances.reduce((a, b) => a + b, 0) / vertexCount;
    const maxRadius = Math.max(...distances);
    const minRadius = Math.min(...distances);
    const ovality = maxRadius - minRadius;
    
    // Deviation from perfect circle (simplified)
    const deviations = distances.map(d => Math.abs(d - meanRadius));
    const maxDeviation = Math.max(...deviations);
    const avgDeviation = deviations.reduce((a, b) => a + b, 0) / vertexCount;
    
    return {
      vertexCount,
      centroid: { x: center.x.toFixed(2), y: center.y.toFixed(2), z: center.z.toFixed(2) },
      meanRadiusMm: meanRadius.toFixed(1),
      maxRadiusMm: maxRadius.toFixed(1),
      minRadiusMm: minRadius.toFixed(1),
      ovalityMm: ovality.toFixed(2),
      meanDeviationMm: avgDeviation.toFixed(2),
      maxDeviationMm: maxDeviation.toFixed(2),
      isCircular: ovality < 10,
      deformationScore: Math.min(100, ovality * 5 + maxDeviation * 3)
    };
  }

  /**
   * Color-code geometry vertices based on deviation
   * Green (0) -> Yellow (0.5) -> Red (1.0)
   */
  applyDeviationColors(geometry, maxDeviationMM) {
    const positions = geometry.getAttribute('position');
    const vertexCount = positions.count;
    const colors = new Float32Array(vertexCount * 3);

    // Calculate centroid
    const center = new THREE.Vector3();
    for (let i = 0; i < vertexCount; i++) {
      center.x += positions.getX(i);
      center.y += positions.getY(i);
      center.z += positions.getZ(i);
    }
    center.divideScalar(vertexCount);

    // Average radius
    const distances = [];
    for (let i = 0; i < vertexCount; i++) {
      const v = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      distances.push(v.distanceTo(center));
    }
    const meanRadius = distances.reduce((a, b) => a + b, 0) / vertexCount;

    // Color each vertex
    for (let i = 0; i < vertexCount; i++) {
      const v = new THREE.Vector3(positions.getX(i), positions.getY(i), positions.getZ(i));
      const r = v.distanceTo(center);
      const deviation = Math.abs(r - meanRadius);
      
      // Normalize deviation (0 = green, 1 = red)
      const t = maxDeviationMM > 0 ? Math.min(1, deviation / maxDeviationMM) : 0;
      
      colors[i * 3] = t;                         // R
      colors[i * 3 + 1] = 1 - t * 0.5;          // G
      colors[i * 3 + 2] = 0;                     // B
    }

    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    return geometry;
  }

}

export default STLImporter;
