import * as THREE from 'three';

/**
 * Automatic decimator for creating low-poly versions of meshes
 * Used for fast boolean previews and simple tool generation
 */
export class Decimator {
  /**
   * Creates a low-poly version of a mesh using simple vertex clustering
   * @param {THREE.Mesh} mesh - Original mesh to decimate
   * @param {Object} options - Decimation options
   * @param {number} options.targetCount - Target triangle count
   * @param {number} options.tolerance - Distance tolerance for vertex clustering
   * @param {boolean} options.preserveBoundaries - Whether to preserve mesh boundaries
   * @returns {THREE.Mesh} Decimated mesh
   */
  static decimate(mesh, options = {}) {
    const {
      targetCount = null,
      tolerance = 0.01,
      preserveBoundaries = false
    } = options;
    
    const geometry = mesh.geometry.clone();
    
    // Early return if geometry is too simple
    const positionAttr = geometry.attributes.position;
    if (!positionAttr || positionAttr.count < 3) {
      return mesh;
    }
    
    const originalTriangleCount = positionAttr.count / 3;
    let targetTriangleCount = targetCount;
    
    // If targetCount not specified, reduce to 25% of original
    if (targetTriangleCount === null) {
      targetTriangleCount = Math.max(4, Math.floor(originalTriangleCount * 0.25));
    }
    
    // If already below target, return original
    if (originalTriangleCount <= targetTriangleCount) {
      return mesh;
    }
    
    // Simple vertex clustering approach
    const positionArray = positionAttr.array;
    const vertexCount = positionAttr.count;
    
    // Create spatial hash grid for vertex clustering
    const gridSize = tolerance;
    const grid = new Map();
    const newPositions = [];
    const vertexRemap = new Array(vertexCount).fill(-1);
    
    // Process each vertex
    for (let i = 0; i < vertexCount; i++) {
      const x = positionArray[i * 3];
      const y = positionArray[i * 3 + 1];
      const z = positionArray[i * 3 + 2];
      
      // Calculate grid cell
      const cellX = Math.floor(x / gridSize);
      const cellY = Math.floor(y / gridSize);
      const cellZ = Math.floor(z / gridSize);
      const cellKey = `${cellX},${cellY},${cellZ}`;
      
      let cell = grid.get(cellKey);
      if (!cell) {
        cell = {
          position: [x, y, z],
          count: 1,
          indices: [i]
        };
        grid.set(cellKey, cell);
      } else {
        // Average position
        cell.position[0] = (cell.position[0] * cell.count + x) / (cell.count + 1);
        cell.position[1] = (cell.position[1] * cell.count + y) / (cell.count + 1);
        cell.position[2] = (cell.position[2] * cell.count + z) / (cell.count + 1);
        cell.count++;
        cell.indices.push(i);
      }
      
      vertexRemap[i] = cell.indices.length - 1; // Store temporary index
    }
    
    // Build new position array from clustered vertices
    const newPositionArray = [];
    const newToOldMap = [];
    
    grid.forEach((cell, key) => {
      newPositionArray.push(cell.position[0], cell.position[1], cell.position[2]);
      newToOldMap.push(cell.indices[0]); // Store first original index
    });
    
    // Remap indices if we have an index buffer
    let newIndexArray = null;
    if (geometry.index) {
      const indexArray = geometry.index.array;
      newIndexArray = [];
      
      for (let i = 0; i < indexArray.length; i++) {
        const oldIndex = indexArray[i];
        const newIndex = vertexRemap[oldIndex];
        if (newIndex !== -1) {
          newIndexArray.push(newIndex);
        }
      }
      
      // Remove degenerate triangles (where vertices are the same after clustering)
      const filteredIndices = [];
      for (let i = 0; i < newIndexArray.length; i += 3) {
        const i0 = newIndexArray[i];
        const i1 = newIndexArray[i + 1];
        const i2 = newIndexArray[i + 2];
        
        // Check if triangle has duplicate vertices
        if (i0 !== i1 && i1 !== i2 && i0 !== i2) {
          filteredIndices.push(i0, i1, i2);
        }
      }
      
      newIndexArray = filteredIndices;
    }
    
    // Create new geometry
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositionArray, 3));
    
    if (newIndexArray && newIndexArray.length > 0) {
      newGeometry.setIndex(new THREE.BufferAttribute(newIndexArray, 1));
    }
    
    // Copy other attributes if they exist
    if (geometry.hasAttribute('normal')) {
      const normalArray = geometry.attributes.normal.array;
      const newNormalArray = [];
      
      for (let i = 0; i < newToOldMap.length; i++) {
        const oldIndex = newToOldMap[i];
        newNormalArray.push(
          normalArray[oldIndex * 3],
          normalArray[oldIndex * 3 + 1],
          normalArray[oldIndex * 2 + 2]
        );
      }
      
      newGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(newNormalArray, 3));
    }
    
    if (geometry.hasAttribute('uv')) {
      const uvArray = geometry.attributes.uv.array;
      const newUvArray = [];
      
      for (let i = 0; i < newToOldMap.length; i++) {
        const oldIndex = newToOldMap[i];
        newUvArray.push(
          uvArray[oldIndex * 2],
          uvArray[oldIndex * 2 + 1]
        );
      }
      
      newGeometry.setAttribute('uv', new THREE.Float32BufferAttribute(newUvArray, 2));
    }
    
    // Compute normals if needed
    if (!geometry.hasAttribute('normal')) {
      newGeometry.computeVertexNormals();
    }
    
    newGeometry.computeBoundingBox();
    newGeometry.computeBoundingSphere();
    
    // Create and return decimated mesh
    const decimatedMesh = new THREE.Mesh(newGeometry, mesh.material);
    decimatedMesh.copy(mesh);
    return decimatedMesh;
  }
  
  /**
   * Creates a low-poly version specifically for boolean preview
   * Optimized for speed over quality
   * @param {THREE.Mesh} mesh - Original mesh
   * @param {number} reductionFactor - How much to reduce (0.1 = 90% reduction)
   * @returns {THREE.Mesh} Low-poly preview mesh
   */
  static createPreviewVersion(mesh, reductionFactor = 0.1) {
    const geometry = mesh.geometry.clone();
    
    // For preview, use aggressive simplification
    const positionAttr = geometry.attributes.position;
    if (!positionAttr) return mesh;
    
    const vertexCount = positionAttr.count;
    const targetVertexCount = Math.max(4, Math.floor(vertexCount * reductionFactor));
    
    if (vertexCount <= targetVertexCount) {
      return mesh;
    }
    
    // Simple uniform sampling for preview
    const step = Math.max(1, Math.floor(vertexCount / targetVertexCount));
    const newPositions = [];
    const newNormals = [];
    
    for (let i = 0; i < vertexCount; i += step) {
      newPositions.push(
        positionAttr.getX(i),
        positionAttr.getY(i),
        positionAttr.getZ(i)
      );
      
      if (geometry.hasAttribute('normal')) {
        const normalAttr = geometry.attributes.normal;
        newNormals.push(
          normalAttr.getX(i),
          normalAttr.getY(i),
          normalAttr.getZ(i)
        );
      }
    }
    
    const newGeometry = new THREE.BufferGeometry();
    newGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    
    if (newNormals.length > 0) {
      newGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(newNormals, 3));
    } else {
      newGeometry.computeVertexNormals();
    }
    
    // Create simple triangulation (for preview, we'll use point cloud or trust the mesh structure)
    // For now, we'll just use the vertices as-is and compute normals
    newGeometry.computeBoundingBox();
    newGeometry.computeBoundingSphere();
    
    const previewMesh = new THREE.Mesh(newGeometry, mesh.material);
    previewMesh.copy(mesh);
    return previewMesh;
  }
  
  /**
   * Creates a simple geometric tool (cylinder, box, sphere) for boolean operations
   * @param {string} type - Type of tool ('box', 'sphere', 'cylinder')
   * @param {Object} params - Parameters for the tool
   * @returns {THREE.Mesh} Simple tool mesh
   */
  static createSimpleTool(type, params = {}) {
    let geometry;
    
    switch (type) {
      case 'box':
        const width = params.width || 1;
        const height = params.height || 1;
        const depth = params.depth || 1;
        const widthSegments = Math.max(1, Math.floor(params.widthSegments || 4));
        const heightSegments = Math.max(1, Math.floor(params.heightSegments || 4));
        const depthSegments = Math.max(1, Math.floor(params.depthSegments || 4));
        geometry = new THREE.BoxGeometry(width, height, depth, widthSegments, heightSegments, depthSegments);
        break;
        
      case 'sphere':
        const radius = params.radius || 1;
        const widthSegments = Math.max(4, Math.floor(params.widthSegments || 8));
        const heightSegments = Math.max(2, Math.floor(params.heightSegments || 6));
        geometry = new THREE.SphereGeometry(radius, widthSegments, heightSegments);
        break;
        
      case 'cylinder':
        const radiusTop = params.radiusTop || 1;
        const radiusBottom = params.radiusBottom || 1;
        const height = params.height || 1;
        const radiusSegments = Math.max(3, Math.floor(params.radiusSegments || 8));
        const heightSegments = Math.max(1, Math.floor(params.heightSegments || 4));
        const openEnded = params.openEnded !== undefined ? params.openEnded : false;
        geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, radiusSegments, heightSegments, openEnded);
        break;
        
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: params.color || 0xff0000,
      wireframe: params.wireframe !== undefined ? params.wireframe : true,
      transparent: params.transparent !== undefined ? params.transparent : true,
      opacity: params.opacity !== undefined ? params.opacity : 0.5
    });
    
    return new THREE.Mesh(geometry, material);
  }
}
