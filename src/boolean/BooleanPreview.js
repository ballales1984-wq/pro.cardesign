import * as THREE from 'three';
import { OptimizedBoolean } from './OptimizedBoolean.js';
import { Decimator } from './Decimator.js';

/**
 * Boolean preview system for real-time visualization of boolean operations
 * Uses low-poly versions for fast preview and full-resolution for final result
 */
export class BooleanPreview {
  constructor(voxelEngine, materialDB) {
    this.voxelEngine = voxelEngine;
    this.materialDB = materialDB;
    this.booleanEngine = new OptimizedBoolean();
    
    // Preview state
    this.previewMesh = null;
    this.originalMesh = null;
    this.toolMesh = null;
    this.operationType = 'subtract';
    this.isActive = false;
    
    // Performance settings
    this.previewQuality = 0.1; // 10% of original for preview
    this.updateTimeout = null;
    this.updateDelay = 100; // ms delay for preview updates
    
    // Create preview scene (invisible until needed)
    this.previewGroup = new THREE.Group();
    this.previewGroup.visible = false;
    voxelEngine.scene.add(this.previewGroup);
  }
  
  /**
   * Starts boolean preview with target and tool meshes
   * @param {THREE.Mesh} targetMesh - Mesh to perform operation on
   * @param {THREE.Mesh} toolMesh - Mesh to use as tool
   * @param {string} operation - Operation type ('subtract', 'union', 'intersect')
   */
  start(targetMesh, toolMesh, operation = 'subtract') {
    if (this.isActive) {
      this.stop();
    }
    
    this.isActive = true;
    this.operationType = operation;
    this.originalMesh = targetMesh;
    
    // Create low-poly versions for fast preview
    const lowPolyTarget = Decimator.createPreviewVersion(targetMesh, this.previewQuality);
    const lowPolyTool = Decimator.createPreviewVersion(toolMesh, this.previewQuality);
    
    // Position tool mesh
    lowPolyTool.position.copy(toolMesh.position);
    lowPolyTool.rotation.copy(toolMesh.rotation);
    lowPolyTool.scale.copy(toolMesh.scale);
    lowPolyTool.updateMatrixWorld(true);
    
    // Store for later use
    this.toolMesh = lowPolyTool;
    
    // Add to preview group
    this.previewGroup.add(lowPolyTarget);
    this.previewGroup.add(lowPolyTool);
    
    // Create initial preview
    this.updatePreview();
    
    // Show preview group
    this.previewGroup.visible = true;
  }
  
  /**
   * Updates the boolean preview based on current tool position
   * Called when tool parameters change
   */
  updatePreview() {
    if (!this.isActive || !this.originalMesh || !this.toolMesh) {
      return;
    }
    
    // Clear previous result
    if (this.previewMesh) {
      this.previewGroup.remove(this.previewMesh);
      if (this.previewMesh.geometry) {
        this.previewMesh.geometry.dispose();
      }
      if (this.previewMesh.material) {
        this.previewMesh.material.dispose();
      }
      this.previewMesh = null;
    }
    
    // Prepare meshes for CSG (using optimized boolean engine)
    try {
      // Perform boolean operation with low-poly meshes for speed
      const resultMesh = this.booleanEngine[this.operationType](
        this.originalMesh, 
        this.toolMesh.geometry, 
        {
          position: this.toolMesh.position,
          rotation: this.toolMesh.rotation,
          scale: this.toolMesh.scale
        }
      );
      
      // Create preview mesh with special material
      const previewMaterial = new THREE.MeshBasicMaterial({
        color: 0x00ff00,
        wireframe: true,
        transparent: true,
        opacity: 0.7
      });
      
      this.previewMesh = new THREE.Mesh(resultMesh.geometry, previewMaterial);
      this.previewGroup.add(this.previewMesh);
      
    } catch (error) {
      console.warn('Boolean preview failed:', error);
      // Show error state
      this.showErrorState();
    }
  }
  
  /**
   * Shows error state when boolean operation fails
   */
  showErrorState() {
    if (this.previewMesh) {
      this.previewGroup.remove(this.previewMesh);
      if (this.previewMesh.geometry) {
        this.previewMesh.geometry.dispose();
      }
      if (this.previewMesh.material) {
        this.previewMesh.material.dispose();
      }
    }
    
    const errorMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      wireframe: true,
      transparent: true,
      opacity: 0.5
    });
    
    // Create a simple error indicator (bounding box of target)
    const box = new THREE.Box3().setFromObject(this.originalMesh);
    const size = new THREE.Vector3();
    box.getSize(size);
    
    const errorGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    this.previewMesh = new THREE.Mesh(errorGeometry, errorMaterial);
    this.previewMesh.position.copy(box.getCenter(new THREE.Vector3()));
    this.previewGroup.add(this.previewMesh);
  }
  
  /**
   * Stops boolean preview and cleans up resources
   */
  stop() {
    if (!this.isActive) return;
    
    // Remove all meshes from preview group
    while (this.previewGroup.children.length > 0) {
      const child = this.previewGroup.children[0];
      this.previewGroup.remove(child);
      
      if (child.geometry) {
        child.geometry.dispose();
      }
      if (child.material) {
        child.material.dispose();
      }
    }
    
    // Reset state
    this.isActive = false;
    this.originalMesh = null;
    this.toolMesh = null;
    this.previewMesh = null;
    this.operationType = 'subtract';
    
    // Hide preview group
    this.previewGroup.visible = false;
  }
  
  /**
   * Performs the actual boolean operation on high-resolution meshes
   * @returns {Promise<THREE.Mesh>} Promise resolving to result mesh
   */
  async performOperation() {
    if (!this.isActive || !this.originalMesh || !this.toolMesh) {
      return null;
    }
    
    try {
      // Use the optimized boolean engine for final operation
      const result = this.booleanEngine[this.operationType](
        this.originalMesh,
        this.toolMesh.geometry,
        {
          position: this.toolMesh.position,
          rotation: this.toolMesh.rotation,
          scale: this.toolMesh.scale
        }
      );
      
      return result;
    } catch (error) {
      console.error('Boolean operation failed:', error);
      return null;
    }
  }
  
  /**
   * Sets the preview quality (0.01 to 1.0)
   * @param {number} quality - Quality factor (default: 0.1)
   */
  setPreviewQuality(quality) {
    this.previewQuality = Math.max(0.01, Math.min(1.0, quality));
  }
  
  /**
   * Sets the operation type
   * @param {string} operation - Operation type ('subtract', 'union', 'intersect')
   */
  setOperationType(operation) {
    if (['subtract', 'union', 'intersect'].includes(operation)) {
      this.operationType = operation;
      if (this.isActive) {
        this.updatePreview();
      }
    }
  }
  
  /**
   * Cleans up resources when preview is no longer needed
   */
  dispose() {
    this.stop();
    
    // Dispose preview group
    if (this.previewGroup.parent) {
      this.previewGroup.parent.remove(this.previewGroup);
    }
    
    // Dispose boolean engine
    this.booleanEngine.clearCache();
    this.booleanEngine.terminateWorkers();
  }
}
