/**
 * Example integration of optimized boolean operations with VoxelEngine
 * Demonstrates usage of OptimizedBoolean, Decimator, and BooleanPreview
 */
import * as THREE from 'three';
import { OptimizedBoolean } from './boolean/OptimizedBoolean.js';
import { Decimator } from './boolean/Decimator.js';
import { BooleanPreview } from './boolean/BooleanPreview.js';

/**
 * Creates a mesh from voxel data for boolean operations
 * @param {VoxelEngine} voxelEngine - The voxel engine instance
 * @param {Object} options - Conversion options
 * @returns {THREE.Mesh} Mesh representation of voxel data
 */
function voxelEngineToMesh(voxelEngine, options = {}) {
  const { smooth = false, material } = options;
  
  // Get all voxels from the engine
  const voxels = [];
  for (const chunk of voxelEngine.chunks.values()) {
    for (const voxel of chunk.voxelsIterator()) {
      voxels.push(voxel);
    }
  }
  
  if (voxels.length === 0) {
    // Return a simple cube if no voxels
    const geometry = new THREE.BoxGeometry(1, 1, 1);
    const mat = material || new THREE.MeshStandardMaterial({ color: 0x808080 });
    return new THREE.Mesh(geometry, mat);
  }
  
  // Convert voxels to geometry
  const exporter = new THREE.MeshExporter(); // Assuming MeshExporter is available globally
  const geometry = exporter.voxelToGeometry(voxels, voxelEngine.voxelSize, smooth);
  
  const mat = material || new THREE.MeshStandardMaterial({ 
    color: 0x808080,
    flatShading: !smooth
  });
  
  return new THREE.Mesh(geometry, mat);
}

/**
 * Example class demonstrating boolean operations on voxel data
 */
export class VoxelBooleanProcessor {
  constructor(voxelEngine, scene, camera, renderer) {
    this.voxelEngine = voxelEngine;
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
    
    // Initialize boolean systems
    this.booleanEngine = new OptimizedBoolean();
    this.decimator = new Decimator();
    
    // Current state
    this.targetMesh = null;
    this.activeTool = null;
    this.isProcessing = false;
  }
  
  /**
   * Updates the target mesh from current voxel data
   * @returns {THREE.Mesh} Updated target mesh
   */
  updateTargetMesh() {
    // Remove old target mesh if exists
    if (this.targetMesh && this.targetMesh.parent) {
      this.targetMesh.parent.remove(this.targetMesh);
      if (this.targetMesh.geometry) {
        this.targetMesh.geometry.dispose();
      }
      if (this.targetMesh.material) {
        this.targetMesh.material.dispose();
      }
    }
    
    // Create new target mesh from voxel data
    this.targetMesh = voxelEngineToMesh(this.voxelEngine, {
      smooth: false,
      material: new THREE.MeshStandardMaterial({
        color: 0x808080,
        flatShading: true
      })
    });
    
    // Add to scene
    this.scene.add(this.targetMesh);
    
    return this.targetMesh;
  }
  
  /**
   * Creates a boolean tool (e.g., cylinder for hole)
   * @param {Object} params - Tool parameters
   * @returns {THREE.Mesh} Tool mesh
   */
  createTool(params = {}) {
    const {
      type = 'cylinder',
      position = new THREE.Vector3(0, 0, 0),
      rotation = new THREE.Euler(0, 0, 0),
      scale = new THREE.Vector3(1, 1, 1),
      segments = 8,
      height = 2,
      radius = 0.5
    } = params;
    
    let geometry;
    
    switch (type) {
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          radius, radius, height, 
          segments, 1, false
        );
        break;
        
      case 'box':
        geometry = new THREE.BoxGeometry(
          scale.x, scale.y, scale.z,
          Math.max(1, Math.floor(segments)),
          Math.max(1, Math.floor(segments)),
          Math.max(1, Math.floor(segments))
        );
        break;
        
      case 'sphere':
        geometry = new THREE.SphereGeometry(
          radius, 
          Math.max(4, Math.floor(segments)),
          Math.max(2, Math.floor(segments))
        );
        break;
        
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1);
    }
    
    const material = new THREE.MeshStandardMaterial({
      color: 0xff0000,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.copy(position);
    mesh.rotation.copy(rotation);
    mesh.scale.copy(scale);
    mesh.updateMatrixWorld(true);
    
    return mesh;
  }
  
  /**
   * Performs boolean subtraction (e.g., create hole)
   * @param {THREE.Mesh} toolMesh - Tool to subtract
   * @returns {Promise<THREE.Mesh>} Result mesh
   */
  async subtractTool(toolMesh) {
    if (this.isProcessing || !this.targetMesh) {
      return null;
    }
    
    this.isProcessing = true;
    
    try {
      // Perform boolean operation using optimized engine
      const result = this.booleanEngine.subtract(
        this.targetMesh,
        toolMesh.geometry,
        {
          position: toolMesh.position,
          rotation: toolMesh.rotation,
          scale: toolMesh.scale
        }
      );
      
      // Update target mesh with result
      await this.updateTargetMeshFromResult(result);
      
      return result;
    } finally {
      this.isProcessing = false;
    }
  }
  
  /**
   * Updates the target mesh with boolean operation result
   * @param {THREE.Mesh} resultMesh - Result from boolean operation
   */
  async updateTargetMeshFromResult(resultMesh) {
    // Remove old target
    if (this.targetMesh && this.targetMesh.parent) {
      this.targetMesh.parent.remove(this.targetMesh);
      if (this.targetMesh.geometry) {
        this.targetMesh.geometry.dispose();
      }
      if (this.targetMesh.material) {
        this.targetMesh.material.dispose();
      }
    }
    
    // Use result as new target
    this.targetMesh = resultMesh;
    this.scene.add(this.targetMesh);
    
    // Optionally: convert back to voxels (for voxel editing)
    // this.meshToVoxelEngine(this.targetMesh);
  }
  
  /**
   * Creates a low-poly preview of boolean operation
   * @param {THREE.Mesh} toolMesh - Tool to preview
   * @returns {THREE.Mesh} Preview mesh
   */
  createBooleanPreview(toolMesh) {
    if (!this.targetMesh) {
      return null;
    }
    
    // Create low-poly versions for fast preview
    const lowPolyTarget = this.decimator.createPreviewVersion(
      this.targetMesh, 
      0.2 // 20% of original for preview
    );
    
    const lowPolyTool = this.decimator.createPreviewVersion(
      toolMesh,
      0.2
    );
    
    lowPolyTool.position.copy(toolMesh.position);
    lowPolyTool.rotation.copy(toolMesh.rotation);
    lowPolyTool.scale.copy(toolMesh.scale);
    lowPolyTool.updateMatrixWorld(true);
    
    try {
      // Perform boolean on low-poly meshes
      const previewResult = this.booleanEngine.subtract(
        lowPolyTarget,
        lowPolyTool.geometry,
        {
          position: lowPolyTool.position,
          rotation: lowPolyTool.rotation,
          scale: lowPolyTool.scale
        }
      );
      
      // Create preview mesh with special material
      const previewMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true,
        transparent: true,
        opacity: 0.6
      });
      
      return new THREE.Mesh(previewResult.geometry, previewMaterial);
    } catch (error) {
      console.warn('Preview boolean failed:', error);
      return null;
    }
  }
  
  /**
   * Cleans up resources
   */
  dispose() {
    // Clean up meshes
    if (this.targetMesh && this.targetMesh.parent) {
      this.targetMesh.parent.remove(this.targetMesh);
      if (this.targetMesh.geometry) {
        this.targetMesh.geometry.dispose();
      }
      if (this.targetMesh.material) {
        this.targetMesh.material.dispose();
      }
    }
    
    // Clean up boolean engine
    this.booleanEngine.clearCache();
    this.booleanEngine.terminateWorkers();
  }
}

// Example usage:
// const booleanProcessor = new VoxelBooleanProcessor(voxelEngine, scene, camera, renderer);
// 
// // Update target from current voxel data
// booleanProcessor.updateTargetMesh();
// 
// // Create a cylindrical tool for making a hole
// const drillTool = booleanProcessor.createTool({
//   type: 'cylinder',
//   position: new THREE.Vector3(0, 2, 0),
//   rotation: new THREE.Euler(Math.PI/2, 0, 0),
//   scale: new THREE.Vector3(1, 1, 1),
//   radius: 0.4,
//   height: 5
// });
// 
// // Add tool to scene for visualization
// scene.add(drillTool);
// 
// // Perform boolean subtraction (create hole)
// booleanProcessor.subtractTool(drillTool)
//   .then(result => {
//     console.log('Boolean operation completed');
//     // Optionally remove tool after operation
//     scene.remove(drillTool);
//     if (drillTool.geometry) drillTool.geometry.dispose();
//     if (drillTool.material) drillTool.material.dispose();
//   });