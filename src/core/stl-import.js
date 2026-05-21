/**
 * STL Importer — Load scanned STL/OBJ/GLTF files and verify fit
 * Enhanced with Blender-inspired robust parsing and quality analysis
 */

// Import dinamico: permette al test runner di iniettare un mock prima del caricamento
const THREE = await import('three');
;

/**
 * Enhanced STL Importer with Blender-inspired robust parsing
 */
export class STLImporter {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
  }

  /**
   * Main import function - routes to appropriate parser based on file extension
   */
  async importFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    switch (ext) {
      case 'stl':
        return this.importSTL(file);
      case 'obj':
        return this.importOBJ(file);
      case 'gltf':
      case 'glb':
        return this.importGLTF(file);
      default:
        throw new Error('Unsupported format: ' + ext);
    }
  }

  /**
   * Import STL file with robust binary/ASCII detection and parsing
   * Adapted from Blender's io_mesh_stl importer
   */
  async importSTL(file) {
    const arrayBuffer = await file.arrayBuffer();
    const headerBytes = new Uint8Array(arrayBuffer, 0, 80);
    const header = String.fromCharCode(...headerBytes);
    
    // Blender-style binary detection:
    // Check if header contains ASCII STL keywords or is all printable ASCII
    const isLikelyASCII = /^(solid\s+[\w\d]*\s*$|facet\s+normal)/i.test(header.trim()) ||
                         [...headerBytes].every(b => b >= 32 && b <= 126); // Printable ASCII
    
    // If header contains null byte or doesn't look like ASCII STL, treat as binary
    const isBinary = headerBytes.includes(0) || !isLikelyASCII;
    
    if (isBinary) {
      return this.parseBinarySTL(arrayBuffer);
    }
    const text = new TextDecoder().decode(arrayBuffer);
    return this.parseASCII_STL(text);
  }

  /**
   * Parse binary STL with Blender-style validation and normal recomputation
   */
  parseBinarySTL(arrayBuffer) {
    const data = new DataView(arrayBuffer);
    let triangleCount = data.getUint32(80, true); // Little endian
    
    // Blender-style validation: verify triangle count matches file size
    const expectedSize = 84 + (triangleCount * 50);
    if (expectedSize > arrayBuffer.byteLength) {
      // File is too small for declared triangle count - adjust
      triangleCount = Math.floor((arrayBuffer.byteLength - 84) / 50);
    }
    
    const vertices = [];
    const normals = [];
    
    for (let i = 0; i < triangleCount; i++) {
      const offset = 84 + i * 50;
      
      // Read normal
      const normalX = data.getFloat32(offset, true);
      const normalY = data.getFloat32(offset + 4, true);
      const normalZ = data.getFloat32(offset + 8, true);
      
      let normal = new THREE.Vector3(normalX, normalY, normalZ);
      
      // Blender-style: recompute normal if it's zero or invalid
      if (normal.lengthSq() === 0 || !isFinite(normal.length())) {
        // Read vertices
        const v1 = new THREE.Vector3(
          data.getFloat32(offset + 12, true),
          data.getFloat32(offset + 16, true),
          data.getFloat32(offset + 20, true)
        );
        const v2 = new THREE.Vector3(
          data.getFloat32(offset + 24, true),
          data.getFloat32(offset + 28, true),
          data.getFloat32(offset + 32, true)
        );
        const v3 = new THREE.Vector3(
          data.getFloat32(offset + 36, true),
          data.getFloat32(offset + 40, true),
          data.getFloat32(offset + 44, true)
        );
        
        // Compute normal from triangle vertices
        normal = new THREE.Vector3()
          .subVectors(v2, v1)
          .cross(v3.clone().sub(v1))
          .normalize();
          
        // If still zero (degenerate triangle), use default up
        if (normal.lengthSq() === 0) {
          normal.set(0, 1, 0);
        }
        
        vertices.push(v1, v2, v3);
        normals.push(normal, normal, normal);
        continue;
      }
      
      // Read vertices
      for (let v = 0; v < 3; v++) {
        const vOffset = offset + 12 + v * 12;
        vertices.push(new THREE.Vector3(
          data.getFloat32(vOffset, true),
          data.getFloat32(vOffset + 4, true),
          data.getFloat32(vOffset + 8, true)
        ));
        normals.push(normal.clone());
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

  /**
   * Parse ASCII STL with Blender-style robust parsing
   * Handles multiple solids, missing normals, and whitespace variations
   */
  parseASCII_STL(text) {
    const vertices = [];
    const normals = [];
    
    const lines = text.split(/\r?\n/);
    let currentNormal = null;
    let currentVerts = [];
    let inSolid = false;
    
    for (const line of lines) {
      const clean = line.trim();
      if (!clean) continue;
      
      // Handle solid blocks (named or unnamed)
      if (clean.match(/^solid\s*/i)) {
        inSolid = true;
        continue;
      }
      
      if (clean.match(/^endsolid\s*/i)) {
        inSolid = false;
        // Flush any pending vertices
        if (currentNormal && currentVerts.length === 3) {
          vertices.push(...currentVerts);
          normals.push(currentNormal, currentNormal, currentNormal);
          currentNormal = null;
          currentVerts = [];
        }
        continue;
      }
      
      if (!inSolid) continue;
      
      // Parse facet normal
      if (clean.match(/^facet\s+normal/i)) {
        const parts = clean.split(/\s+/);
        // Extract normal components (may be missing/invalid)
        const nx = parseFloat(parts[2]);
        const ny = parseFloat(parts[3]);
        const nz = parseFloat(parts[4]);
        
        currentNormal = new THREE.Vector3(nx, ny, nz);
        currentVerts = [];
        
        // If normal is invalid, we'll compute it later from vertices
        continue;
      }
      
      // Parse vertex
      if (clean.match(/^vertex\s+/i) && currentNormal !== null) {
        const parts = clean.split(/\s+/);
        currentVerts.push(new THREE.Vector3(
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3])
        ));
        continue;
      }
      
      // Handle endfacet
      if (clean === 'endfacet' && currentVerts.length === 3) {
        // Use provided normal if valid, otherwise compute from vertices
        let normalToUse = currentNormal;
        if (normalToUse.lengthSq() === 0 || !isFinite(normalToUse.length())) {
          // Compute normal from triangle vertices
          const v0 = currentVerts[0];
          const v1 = currentVerts[1];
          const v2 = currentVerts[2];
          normalToUse = new THREE.Vector3()
            .subVectors(v1, v0)
            .cross(v2.clone().sub(v0))
            .normalize();
            
          // If still zero (degenerate), use default up
          if (normalToUse.lengthSq() === 0) {
            normalToUse.set(0, 1, 0);
          }
        }
        
        vertices.push(...currentVerts);
        normals.push(normalToUse, normalToUse, normalToUse);
        currentNormal = null;
        currentVerts = [];
      }
    }
    
    // Handle case where file ends without endsolid
    if (currentNormal && currentVerts.length === 3) {
      let normalToUse = currentNormal;
      if (normalToUse.lengthSq() === 0 || !isFinite(normalToUse.length())) {
        const v0 = currentVerts[0];
        const v1 = currentVerts[1];
        const v2 = currentVerts[2];
        normalToUse = new THREE.Vector3()
          .subVectors(v1, v0)
          .cross(v2.clone().sub(v0))
          .normalize();
          
        if (normalToUse.lengthSq() === 0) {
          normalToUse.set(0, 1, 0);
        }
      }
      
      vertices.push(...currentVerts);
      normals.push(normalToUse, normalToUse, normalToUse);
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

  /**
   * Import OBJ file (unchanged from original)
   */
  async importOBJ(file) {
    const text = await file.text();
    return this.parseASCII_OBJ(text);
  }

  /**
   * Parse ASCII OBJ - handles vertices, faces, normals
   */
  parseASCII_OBJ(text) {
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
        // Process triangular faces (triangulate if needed)
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

  /**
   * Import GLTF/GLB file using Three.js GLTFLoader
   * Follows same dynamic import pattern as main THREE import
   */
  async importGLTF(file) {
    // Dynamically import GLTFLoader to avoid hard dependency
    const { GLTFLoader } = await import('three/examples/jsm/loaders/GLTFLoader.js');
    
    return new Promise((resolve, reject) => {
      const loader = new GLTFLoader();
      const arrayBufferUrl = URL.createObjectURL(file);
      
      loader.load(
        arrayBufferUrl,
        (gltf) => {
          URL.revokeObjectURL(arrayBufferUrl);
          
          // Extract geometries from GLTF scene
          const geometries = [];
          gltf.scene.traverse((child) => {
            if (child.isMesh && child.geometry) {
              geometries.push(child.geometry.clone());
            }
          });
          
          if (geometries.length === 0) {
            reject(new Error('No mesh geometry found in GLTF file'));
            return;
          }
          
          // If multiple geometries, merge them
          let finalGeometry;
          if (geometries.length === 1) {
            finalGeometry = geometries[0];
          } else {
            // Simple merge - put all vertices in one geometry
            const mergedGeometry = new THREE.BufferGeometry();
            const allPositions = [];
            const allNormals = [];
            let vertexOffset = 0;
            
            geometries.forEach(geom => {
              const posAttr = geom.getAttribute('position');
              const normAttr = geom.getAttribute('normal');
              
              if (posAttr) {
                for (let i = 0; i < posAttr.count; i++) {
                  allPositions.push(
                    posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)
                  );
                }
              }
              
              if (normAttr) {
                for (let i = 0; i < normAttr.count; i++) {
                  allNormals.push(
                    normAttr.getX(i), normAttr.getY(i), normAttr.getZ(i)
                  );
                }
              } else {
                // Generate normals if missing
                // For simplicity, compute per-face normals
                const posCount = posAttr ? posAttr.count : 0;
                for (let i = 0; i < posCount; i += 3) {
                  if (i + 2 < posCount) {
                    const v0 = new THREE.Vector3(
                      posAttr.getX(i), posAttr.getY(i), posAttr.getZ(i)
                    );
                    const v1 = new THREE.Vector3(
                      posAttr.getX(i+1), posAttr.getY(i+1), posAttr.getZ(i+1)
                    );
                    const v2 = new THREE.Vector3(
                      posAttr.getX(i+2), posAttr.getY(i+2), posAttr.getZ(i+2)
                    );
                    const normal = new THREE.Vector3()
                      .subVectors(v1, v0)
                      .cross(v2.clone().sub(v0))
                      .normalize();
                      
                    allNormals.push(normal.x, normal.y, normal.z, 
                                  normal.x, normal.y, normal.z,
                                  normal.x, normal.y, normal.z);
                  }
                }
              }
            });
            
            mergedGeometry.setAttribute('position', 
              new THREE.Float32BufferAttribute(allPositions, 3));
            if (allNormals.length > 0) {
              mergedGeometry.setAttribute('normal',
                new THREE.Float32BufferAttribute(allNormals, 3));
            }
            
            mergedGeometry.computeBoundingSphere();
            finalGeometry = mergedGeometry;
          }
          
          resolve(finalGeometry);
        },
        undefined, // onProgress callback
        (error) => {
          URL.revokeObjectURL(arrayBufferUrl);
          reject(new Error('GLTF loading failed: ' + error.message));
        }
      );
    });
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

/**
 * Enhanced Quality Analyzer with Blender-inspired convex hull and deviation analysis
 */
export class QualityAnalyzer {
  analyzeGeometry(geometry, expectedDiameterMm = 600) {
    const positions = geometry.getAttribute('position');
    const vertexCount = positions.count;
    
    if (vertexCount === 0) {
      return {
        vertexCount: 0,
        centroid: { x: 0, y: 0, z: 0 },
        meanRadiusMm: 0,
        maxRadiusMm: 0,
        minRadiusMm: 0,
        ovalityMm: 0,
        meanDeviationMm: 0,
        maxDeviationMm: 0,
        isCircular: true,
        deformationScore: 0,
        convexHullVolumeMm3: 0,
        sphericity: 0,
        eulerCharacteristic: 0
      };
    }
    
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
    
    // Blender-inspired quality metrics
    
    // 1. Convex hull volume approximation (using bounding box for simplicity)
    // In a full implementation, we'd compute actual convex hull
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    const bboxSize = new THREE.Vector3();
    bbox.getSize(bboxSize);
    const convexHullVolumeMm3 = bboxSize.x * bboxSize.y * bboxSize.z;
    
    // 2. Sphericity approximation: volume of sphere / volume of bbox
    const sphereVolume = (4/3) * Math.PI * Math.pow(meanRadius, 3);
    const sphericity = convexHullVolumeMm3 > 0 ? sphereVolume / convexHullVolumeMm3 : 0;
    
    // 3. Euler characteristic approximation (for closed meshes: V - E + F)
    // Simplified: assume triangular mesh, estimate from vertex count
    const estimatedFaces = vertexCount / 2; // Rough approximation for manifold mesh
    const estimatedEdges = estimatedFaces * 3 / 2; // Each edge shared by 2 faces
    const eulerCharacteristic = Math.round(vertexCount - estimatedEdges + estimatedFaces);
    
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
      deformationScore: Math.min(100, ovality * 5 + maxDeviation * 3),
      // Blender-inspired additional metrics
      convexHullVolumeMm3: convexHullVolumeMm3.toFixed(1),
      sphericity: sphericity.toFixed(3),
      eulerCharacteristic: eulerCharacteristic
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