import { CSG } from 'three-bvh-csg';
import * as THREE from 'three';

/**
 * Optimized boolean operations with BVH caching for better performance
 * Prepares geometries once and reuses BVH trees for repeated operations
 */
export class OptimizedBoolean {
  constructor() {
    // Cache for prepared brush meshes (geometryId -> prepared mesh)
    this.brushCache = new Map();
    // Cache for prepared target meshes
    this.targetCache = new Map();
    // Worker pool for heavy operations
    this.workerPool = [];
    this.maxWorkers = navigator.hardwareConcurrency || 4;
    this.pendingOperations = new Map();
    this.workerIdCounter = 0;
  }

  /**
   * Prepares a mesh for CSG operations by building BVH tree
   * @param {THREE.Mesh} mesh - Mesh to prepare
   * @returns {THREE.Mesh} Prepared mesh with BVH tree
   */
  prepareMeshForCSG(mesh) {
    // Clone geometry to avoid modifying original
    const geometry = mesh.geometry.clone();
    
    // Center geometry for better floating point precision
    geometry.center();
    
    // Remove unnecessary attributes
    if (geometry.hasAttribute('color')) {
      geometry.deleteAttribute('color');
    }
    if (geometry.hasAttribute('uv')) {
      geometry.deleteAttribute('uv');
    }
    
    // Build BVH tree (expensive operation - do once)
    if (!geometry.boundsTree) {
      geometry.boundsTree = new THREE.MeshBVH(geometry, {
        strategy: 0, // SAH (Surface Area Heuristic) - best quality
        maxDepth: 40,
        maxLeafTris: 10
      });
    }
    
    // Create mesh with prepared geometry
    const preparedMesh = new THREE.Mesh(geometry, mesh.material);
    preparedMesh.copy(mesh);
    preparedMesh.geometry = geometry;
    
    return preparedMesh;
  }

  /**
   * Gets a prepared brush from cache or creates new one
   * @param {THREE.BufferGeometry} geometry - Base geometry for brush
   * @param {THREE.Material} material - Material for brush
   * @returns {THREE.Mesh} Prepared brush mesh
   */
  getPreparedBrush(geometry, material = null) {
    // Create cache key from geometry properties
    const key = geometry.uuid;
    
    if (!this.brushCache.has(key)) {
      const mesh = new THREE.Mesh(geometry, material || new THREE.MeshStandardMaterial({
        color: 0xff0000,
        wireframe: true
      }));
      const preparedMesh = this.prepareMeshForCSG(mesh);
      this.brushCache.set(key, preparedMesh);
    }
    
    return this.brushCache.get(key);
  }

/**
    * Performs boolean subtraction operation with caching
    * @param {THREE.Mesh} targetMesh - Target mesh to subtract from
    * @param {THREE.BufferGeometry} toolGeometry - Geometry to subtract
    * @param {Object} toolParams - Position, rotation, scale for tool
    * @returns {THREE.Mesh} Result of boolean operation
    */
  subtract(targetMesh, toolGeometry, toolParams = {}) {
    // Get or create prepared brush
    const brushMesh = this.getPreparedBrush(toolGeometry);
    
    // Apply transformations to brush
    brushMesh.position.copy(toolParams.position || new THREE.Vector3());
    if (toolParams.rotation && toolParams.rotation.isEuler) {
      brushMesh.rotation.copy(toolParams.rotation);
    } else {
      brushMesh.rotation.set(0, 0, 0);
    }
    brushMesh.scale.copy(toolParams.scale || new THREE.Vector3(1, 1, 1));
    brushMesh.updateMatrixWorld(true);
    
    // Prepare target mesh if not already prepared
    const targetKey = targetMesh.geometry.uuid;
    let preparedTarget;
    
    if (this.targetCache.has(targetKey)) {
      preparedTarget = this.targetCache.get(targetKey);
      // Copy current transform to cached mesh
      preparedTarget.position.copy(targetMesh.position);
      preparedTarget.rotation.copy(targetMesh.rotation);
      preparedTarget.scale.copy(targetMesh.scale);
      preparedTarget.updateMatrixWorld(true);
    } else {
      preparedTarget = this.prepareMeshForCSG(targetMesh);
      this.targetCache.set(targetKey, preparedTarget);
    }
    
    // Perform CSG operation
    const result = CSG.subtract(preparedTarget, brushMesh);
    
    // Clean up result geometry
    this.cleanResultGeometry(result.geometry);
    
    return result;
  }

/**
    * Performs boolean union operation with caching
    * @param {THREE.Mesh} targetMesh - Target mesh to union with
    * @param {THREE.BufferGeometry} toolGeometry - Geometry to union
    * @param {Object} toolParams - Position, rotation, scale for tool
    * @returns {THREE.Mesh} Result of boolean operation
    */
  union(targetMesh, toolGeometry, toolParams = {}) {
    // Get or create prepared brush
    const brushMesh = this.getPreparedBrush(toolGeometry);
    
    // Apply transformations to brush
    brushMesh.position.copy(toolParams.position || new THREE.Vector3());
    if (toolParams.rotation && toolParams.rotation.isEuler) {
      brushMesh.rotation.copy(toolParams.rotation);
    } else {
      brushMesh.rotation.set(0, 0, 0);
    }
    brushMesh.scale.copy(toolParams.scale || new THREE.Vector3(1, 1, 1));
    brushMesh.updateMatrixWorld(true);
    
    // Prepare target mesh if not already prepared
    const targetKey = targetMesh.geometry.uuid;
    let preparedTarget;
    
    if (this.targetCache.has(targetKey)) {
      preparedTarget = this.targetCache.get(targetKey);
      // Copy current transform to cached mesh
      preparedTarget.position.copy(targetMesh.position);
      preparedTarget.rotation.copy(targetMesh.rotation);
      preparedTarget.scale.copy(targetMesh.scale);
      preparedTarget.updateMatrixWorld(true);
    } else {
      preparedTarget = this.prepareMeshForCSG(targetMesh);
      this.targetCache.set(targetKey, preparedTarget);
    }
    
    // Perform CSG operation
    const result = CSG.union(preparedTarget, brushMesh);
    
    // Clean up result geometry
    this.cleanResultGeometry(result.geometry);
    
    return result;
  }

/**
    * Performs boolean intersection operation with caching
    * @param {THREE.Mesh} targetMesh - Target mesh to intersect
    * @param {THREE.BufferGeometry} toolGeometry - Geometry to intersect with
    * @param {Object} toolParams - Position, rotation, scale for tool
    * @returns {THREE.Mesh} Result of boolean operation
    */
  intersect(targetMesh, toolGeometry, toolParams = {}) {
    // Get or create prepared brush
    const brushMesh = this.getPreparedBrush(toolGeometry);
    
    // Apply transformations to brush
    brushMesh.position.copy(toolParams.position || new THREE.Vector3());
    if (toolParams.rotation && toolParams.rotation.isEuler) {
      brushMesh.rotation.copy(toolParams.rotation);
    } else {
      brushMesh.rotation.set(0, 0, 0);
    }
    brushMesh.scale.copy(toolParams.scale || new THREE.Vector3(1, 1, 1));
    brushMesh.updateMatrixWorld(true);
    
    // Prepare target mesh if not already prepared
    const targetKey = targetMesh.geometry.uuid;
    let preparedTarget;
    
    if (this.targetCache.has(targetKey)) {
      preparedTarget = this.targetCache.get(targetKey);
      // Copy current transform to cached mesh
      preparedTarget.position.copy(targetMesh.position);
      preparedTarget.rotation.copy(targetMesh.rotation);
      preparedTarget.scale.copy(targetMesh.scale);
      preparedTarget.updateMatrixWorld(true);
    } else {
      preparedTarget = this.prepareMeshForCSG(targetMesh);
      this.targetCache.set(targetKey, preparedTarget);
    }
    
    // Perform CSG operation
    const result = CSG.intersect(preparedTarget, brushMesh);
    
    // Clean up result geometry
    this.cleanResultGeometry(result.geometry);
    
    return result;
  }

  /**
   * Cleans up result geometry for proper rendering and export
   * @param {THREE.BufferGeometry} geometry - Geometry to clean
   */
  cleanResultGeometry(geometry) {
    // Compute normals for proper lighting
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    // Note: We keep drawRange for performance during editing
    // It should be removed only when exporting
  }

  /**
   * Removes drawRange for clean export (call before exporting)
   * @param {THREE.BufferGeometry} geometry - Geometry to prepare for export
   */
  prepareForExport(geometry) {
    if (geometry.drawRange) {
      geometry.drawRange.count = Infinity;
      geometry.drawRange.start = 0;
    }
  }

  /**
   * Creates a low-poly version of a mesh for fast preview
   * @param {THREE.Mesh} mesh - Original mesh
   * @param {number} targetCount - Target triangle count (default: 10% of original)
   * @returns {THREE.Mesh} Low-poly version of mesh
   */
  createLowPolyVersion(mesh, targetCount = null) {
    const geometry = mesh.geometry.clone();
    
    // If targetCount not specified, use 10% of original
    if (targetCount === null) {
      const originalCount = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
      targetCount = Math.max(10, Math.floor(originalCount * 0.1));
    }
    
    // Simple decimation by removing vertices (for demo - in production use proper decimation)
    const positionAttr = geometry.attributes.position;
    const vertexCount = positionAttr.count;
    
    if (vertexCount > targetCount * 3) {
      // Create new buffer with fewer vertices
      const newPosition = new THREE.Float32BufferAttribute(targetCount * 3, 3);
      const newNormal = new THREE.Float32BufferAttribute(targetCount * 3, 3);
      
      // Simple uniform sampling
      const step = Math.ceil(vertexCount / (targetCount * 3));
      let newIndex = 0;
      
      for (let i = 0; i < vertexCount; i += step) {
        if (newIndex >= targetCount * 3) break;
        
        newPosition.setXYZ(
          newIndex,
          positionAttr.getX(i),
          positionAttr.getY(i),
          positionAttr.getZ(i)
        );
        
        // Copy normal if exists
        if (geometry.hasAttribute('normal')) {
          const normalAttr = geometry.attributes.normal;
          newNormal.setXYZ(
            newIndex,
            normalAttr.getX(i),
            normalAttr.getY(i),
            normalAttr.getZ(i)
          );
        }
        
        newIndex += 3;
      }
      
      geometry.setAttribute('position', newPosition);
      geometry.setAttribute('normal', newNormal);
      
      // Remove index if existed
      if (geometry.index) {
        geometry.deleteAttribute('index');
      }
      
      geometry.computeVertexNormals();
    }
    
    return new THREE.Mesh(geometry, mesh.material);
  }

  /**
   * Creates a worker for offloading heavy CSG operations
   * @returns {Promise<Worker>} Promise resolving to a worker
   */
  createWorker() {
    return new Promise((resolve) => {
      const worker = new Worker(URL.createObjectURL(new Blob([`
        importScripts('https://unpkg.com/three@0.167.1/build/three.min.js');
        importScripts('https://unpkg.com/three-mesh-bvh@0.5.23/dist/three-mesh-bvh.min.js');
        importScripts('https://unpkg.com/three-bvh-csg@0.0.3/dist/three-bvh-csg.min.js');
        
        self.onmessage = function(e) {
          const { operation, targetData, toolData, toolParams, id } = e.data;
          
          try {
            // Reconstruct geometries
            const targetGeometry = new THREE.BufferGeometry();
            targetGeometry.setAttribute('position', new THREE.Float32BufferAttribute(targetData.position, 3));
            if (targetData.normal) {
              targetGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(targetData.normal, 3));
            }
            if (targetData.index) {
              targetGeometry.setIndex(new THREE.BufferAttribute(targetData.index, 1));
            }
            
            const toolGeometry = new THREE.BufferGeometry();
            toolGeometry.setAttribute('position', new THREE.Float32BufferAttribute(toolData.position, 3));
            if (toolData.normal) {
              toolGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(toolData.normal, 3));
            }
            if (toolData.index) {
              toolGeometry.setIndex(new THREE.BufferAttribute(toolData.index, 1));
            }
            
            // Create meshes
            const targetMesh = new THREE.Mesh(targetGeometry);
            const toolMesh = new THREE.Mesh(toolGeometry);
            
            // Apply tool transform
            toolMesh.position.fromArray(toolParams.position || [0, 0, 0]);
            toolMesh.rotation.fromArray(toolParams.rotation || [0, 0, 0]);
            toolMesh.scale.fromArray(toolParams.scale || [1, 1, 1]);
            toolMesh.updateMatrixWorld(true);
            
            // Prepare meshes for CSG
            if (!targetGeometry.boundsTree) {
              targetGeometry.boundsTree = new THREE.MeshBVH(targetGeometry, {
                strategy: 0,
                maxDepth: 40,
                maxLeafTris: 10
              });
            }
            
            if (!toolGeometry.boundsTree) {
              toolGeometry.boundsTree = new THREE.MeshBVH(toolGeometry, {
                strategy: 0,
                maxDepth: 40,
                maxLeafTris: 10
              });
            }
            
            let result;
            switch (operation) {
              case 'subtract':
                result = CSG.subtract(targetMesh, toolMesh);
                break;
              case 'union':
                result = CSG.union(targetMesh, toolMesh);
                break;
              case 'intersect':
                result = CSG.intersect(targetMesh, toolMesh);
                break;
              default:
                throw new Error('Unknown operation: ' + operation);
            }
            
            // Extract result data
            const resultData = {
              position: result.geometry.attributes.position.array,
              normal: result.geometry.attributes.normal ? result.geometry.attributes.normal.array : null,
              index: result.geometry.index ? result.geometry.index.array : null
            };
            
            self.postMessage({ result: resultData, id });
          } catch (error) {
            self.postMessage({ error: error.message, id });
          }
        };
      `, { type: 'application/javascript' })));
      
      resolve(worker);
    });
  }

  /**
   * Performs CSG operation using Web Worker for heavy computations
   * @param {THREE.Mesh} targetMesh - Target mesh
   * @param {THREE.BufferGeometry} toolGeometry - Tool geometry
   * @param {string} operation - Operation type ('subtract', 'union', 'intersect')
   * @param {Object} toolParams - Tool transformation parameters
   * @returns {Promise<THREE.Mesh>} Promise resolving to result mesh
   */
  async performOperationWithWorker(targetMesh, toolGeometry, operation, toolParams = {}) {
    // Get or create worker
    let worker = this.workerPool.find(w => !w.busy);
    
    if (!worker && this.workerPool.length < this.maxWorkers) {
      worker = await this.createWorker();
      worker.busy = false;
      this.workerPool.push(worker);
    }
    
    if (!worker) {
      // Fallback to main thread if no workers available
      return this[operation](targetMesh, toolGeometry, toolParams);
    }
    
    // Mark worker as busy
    worker.busy = true;
    
    // Prepare data for transfer
    const targetData = {
      position: targetMesh.geometry.attributes.position.array,
      normal: targetMesh.geometry.attributes.normal ? targetMesh.geometry.attributes.normal.array : null,
      index: targetMesh.geometry.index ? targetMesh.geometry.index.array : null
    };
    
    const toolData = {
      position: toolGeometry.attributes.position.array,
      normal: toolGeometry.attributes.normal ? toolGeometry.attributes.normal.array : null,
      index: toolGeometry.index ? toolGeometry.index.array : null
    };
    
    const toolParamData = {
      position: [
        toolParams.position?.x ?? 0,
        toolParams.position?.y ?? 0,
        toolParams.position?.z ?? 0
      ],
      rotation: [
        toolParams.rotation?.x ?? 0,
        toolParams.rotation?.y ?? 0,
        toolParams.rotation?.z ?? 0
      ],
      scale: [
        toolParams.scale?.x ?? 1,
        toolParams.scale?.y ?? 1,
        toolParams.scale?.z ?? 1
      ]
    };
    
    const workerId = this.workerIdCounter++;
    
    return new Promise((resolve, reject) => {
      const handler = (e) => {
        if (e.data.id === workerId) {
          worker.removeEventListener('message', handler);
          worker.busy = false;
          
          if (e.data.error) {
            reject(new Error(e.data.error));
          } else {
            // Reconstruct result mesh
            const resultGeometry = new THREE.BufferGeometry();
            resultGeometry.setAttribute('position', new THREE.Float32BufferAttribute(e.data.result.position, 3));
            
            if (e.data.result.normal) {
              resultGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(e.data.result.normal, 3));
            }
            
            if (e.data.result.index) {
              resultGeometry.setIndex(new THREE.BufferAttribute(e.data.result.index, 1));
            }
            
            resultGeometry.computeVertexNormals();
            resultGeometry.computeBoundingBox();
            resultGeometry.computeBoundingSphere();
            
            const resultMesh = new THREE.Mesh(resultGeometry);
            resolve(resultMesh);
          }
        }
      };
      
      worker.addEventListener('message', handler);
      
      worker.postMessage({
        operation,
        targetData,
        toolData,
        toolParams: toolParamData,
        id: workerId
      });
      
      // Timeout fallback
      setTimeout(() => {
        if (worker.busy) {
          worker.removeEventListener('message', handler);
          worker.busy = false;
          reject(new Error('Worker operation timed out'));
        }
      }, 30000);
    });
  }

  /**
   * Clears all caches to free memory
   */
  clearCache() {
    this.brushCache.clear();
    this.targetCache.clear();
  }

  /**
   * Terminates all workers
   */
  terminateWorkers() {
    for (const worker of this.workerPool) {
      worker.terminate();
    }
    this.workerPool = [];
  }
}