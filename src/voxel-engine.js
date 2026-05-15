/**
 * VoxelEngine - Manages the 3D grid, rendering and voxel interaction
 *
 * Uses InstancedMesh for material — a single draw call per material
 * instead of one per voxel. Improvement: ~10-50x with large scenes.
 */
import * as THREE from 'three';
import { ScalingTool } from './core/scaling-tool.js';

export class VoxelEngine {
    constructor(scene, materialDB, moduleSystem, camera, renderer, controls) {
        this.scene = scene;
        this.materialDB = materialDB;
        this.moduleSystem = moduleSystem;
        this.camera = camera;
        this.renderer = renderer;
        this.controls = controls;

        // Chunk-based storage: Map<"chunkX,chunkY,chunkZ", Chunk>
        this.chunks = new Map();
        this.chunkSize = 16; // voxels per chunk dimension

        // Instanced rendering: one InstancedMesh per material
        this.instancedMeshes = new Map();
        this.instanceToKey = new Map();
        this.keyToInstance = new Map();
        this.freeIndices = new Map();
        this.maxInstances = 200000;

        this.voxelGroup = new THREE.Group();
        this.scene.add(this.voxelGroup);

        this.ghost = null;
        this._createGhost();

        this.highlight = null;
        this._createHighlight();

        this.sharedGeometry = new THREE.BoxGeometry(1.0, 1.0, 1.0);

        this._createAxisLabels();

        // Invisible ground plane for raycasting (first voxel)
        const groundGeo = new THREE.PlaneGeometry(200, 200);
        groundGeo.rotateX(-Math.PI / 2);
        const groundMat = new THREE.MeshBasicMaterial({ visible: false });
        this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
        this.groundPlane.frustumCulled = false; // always test in raycasting
        this.scene.add(this.groundPlane);

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        this.selectedVoxel = null;
        this.activeMaterial = 'steel';
        this.activeModule = null;
        this.activeTool = 'add';
        this.voxelSize = 1.0;

        this._history = [];
        this._redoStack = [];
        this._maxHistory = 50;
        this._maxRedo = 50;

         this._setupEvents();
         this._setupScalePanelListeners();
         
         // Initialize ScalingTool
         this.scalingTool = new ScalingTool(this, this.scene, this.camera, this.renderer);
       }
   
       // ── Chunk management ────────────────────────────────────────
       _getChunkKey(pos) {
         const chunkSize = this.chunkSize;
         const chunkX = Math.floor(pos.x / chunkSize);
         const chunkY = Math.floor(pos.y / chunkSize);
         const chunkZ = Math.floor(pos.z / chunkSize);
         return `${chunkX},${chunkY},${chunkZ}`;
       }
   
       _getLocalKey(pos) {
         const chunkSize = this.chunkSize;
         // Using modulo that works for negative numbers
         const lx = ((pos.x % chunkSize) + chunkSize) % chunkSize;
         const ly = ((pos.y % chunkSize) + chunkSize) % chunkSize;
         const lz = ((pos.z % chunkSize) + chunkSize) % chunkSize;
         return { x: lx, y: ly, z: lz };
       }
   
       _getOrCreateChunk(chunkKey) {
         let chunk = this.chunks.get(chunkKey);
         if (!chunk) {
           const [chunkX, chunkY, chunkZ] = chunkKey.split(',').map(Number);
           chunk = new Chunk(chunkX, chunkY, chunkZ, this.chunkSize);
           this.chunks.set(chunkKey, chunk);
         }
         return chunk;
       }
   
     // ── InstancedMesh management ──────────────────────────────────
   
       _getInstancedMesh(materialName) {
         let mesh = this.instancedMeshes.get(materialName);
         if (mesh) return mesh;
   
         const mat = this.materialDB.get(materialName);
         if (!mat) return null;
   
         const opts = {
           color: new THREE.Color(mat.color),
           roughness: mat.roughness || 0.4,
           metalness: mat.metalness || 0.3,
         };
         if (mat.transparent) {
           opts.transparent = true;
           opts.opacity = mat.opacity || 0.6;
           opts.depthWrite = false;
         }
   
         const material = new THREE.MeshStandardMaterial(opts);
         material.name = materialName;
         mesh = new THREE.InstancedMesh(this.sharedGeometry, material, this.maxInstances);
         mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
         mesh.castShadow = true;
         mesh.receiveShadow = true;
         mesh.frustumCulled = true;
         this.voxelGroup.add(mesh);
   
         this.instancedMeshes.set(materialName, mesh);
         this.instanceToKey.set(materialName, new Array(this.maxInstances).fill(null));
         this.keyToInstance.set(materialName, new Map());
         this.freeIndices.set(materialName, []);
   
         return mesh;
       }
   
       _getInstanceId(materialName) {
         const free = this.freeIndices.get(materialName);
         if (free && free.length > 0) return free.pop();
         const map = this.keyToInstance.get(materialName);
         return map ? map.size : 0;
       }
   
        _setInstanceMatrix(mesh, instanceId, position, scale = new THREE.Vector3(1, 1, 1)) {
              const matrix = new THREE.Matrix4();
              matrix.makeScale(scale.x, scale.y, scale.z);
              matrix.setPosition(new THREE.Vector3(position.x, position.y, position.z));
              mesh.setMatrixAt(instanceId, matrix);
              mesh.instanceMatrix.needsUpdate = true;
          }

        _applyVoxelScaleToVoxel(voxel, scaleX, scaleY, scaleZ) {
              // Update voxel data
              voxel.scale = [scaleX, scaleY, scaleZ];

              // Update InstancedMesh
              const materialName = voxel.material;
              const mesh = this.instancedMeshes.get(materialName);
              if (mesh) {
                  const key = this._gridKey({ x: voxel.x, y: voxel.y, z: voxel.z });
                  const instanceId = this.keyToInstance.get(materialName).get(key);
                  if (instanceId !== undefined) {
                      this._setInstanceMatrix(mesh, instanceId, this._worldPos({ x: voxel.x, y: voxel.y, z: voxel.z }), 
                                             new THREE.Vector3(scaleX, scaleY, scaleZ));
           }
       }
      }
   
       // ── Rendering ────────────────────────────────────────────────
   
       _createAxisLabels() {
         const makeLabel = (text, color, pos) => {
           const canvas = document.createElement('canvas');
           canvas.width = 128;
           canvas.height = 64;
           const ctx = canvas.getContext('2d');
           ctx.font = 'bold 48px sans-serif';
           ctx.fillStyle = '#' + color;
           ctx.textAlign = 'center';
           ctx.textBaseline = 'middle';
           ctx.fillText(text, 64, 32);
           const tex = new THREE.CanvasTexture(canvas);
           tex.needsUpdate = true;
           const spriteMat = new THREE.SpriteMaterial({ map: tex, depthTest: false });
           const sprite = new THREE.Sprite(spriteMat);
           sprite.position.copy(pos);
           sprite.scale.set(1.2, 0.6, 1);
           this.scene.add(sprite);
         };
   
         makeLabel('X', 'ff4444', new THREE.Vector3(6, 0, 0));
         makeLabel('Y', '44ff44', new THREE.Vector3(0, 6, 0));
         makeLabel('Z', '4488ff', new THREE.Vector3(0, 0, 6));
       }
   
       _createGhost() {
         const geo = new THREE.BoxGeometry(this.voxelSize, this.voxelSize, this.voxelSize);
         const mat = new THREE.MeshBasicMaterial({
           color: 0x00d2ff,
           transparent: true,
           opacity: 0.5,
           depthWrite: false,
           wireframe: true,
           linewidth: 2,
         });
         this.ghost = new THREE.Mesh(geo, mat);
         this.ghost.visible = false;
         this.scene.add(this.ghost);
       }
   
       _createHighlight() {
         const geo = new THREE.BoxGeometry(
           this.voxelSize * 1.05,
           this.voxelSize * 1.05,
           this.voxelSize * 1.05
         );
         const edges = new THREE.EdgesGeometry(geo);
         const mat = new THREE.LineBasicMaterial({
           color: 0xe94560,
           linewidth: 2,
           transparent: true,
           opacity: 0.8,
         });
         this.highlight = new THREE.LineSegments(edges, mat);
         this.highlight.visible = false;
         this.scene.add(this.highlight);
       }
   
         _setupEvents() {
             const canvas = this.renderer.domElement;
             canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
             canvas.addEventListener('click', (e) => this._onPointerClick(e));
             canvas.addEventListener('contextmenu', (e) => e.preventDefault());
             window.addEventListener('keydown', (e) => this._onKeyDown(e));
         }
   
         _setupScalePanelListeners() {
             const self = this;
             
             // Apply scale button
             document.getElementById('apply-scale').addEventListener('click', function() {
                 if (!self.selectedVoxel) {
                     self._notify('Select a voxel before applying scale', 'warn');
                     return;
                 }
                 
                 const scaleX = parseFloat(document.getElementById('scale-x').value) || 1.0;
                 const scaleY = parseFloat(document.getElementById('scale-y').value) || 1.0;
                 const scaleZ = parseFloat(document.getElementById('scale-z').value) || 1.0;
                 
                 self.scaleSelectedVoxel(scaleX, scaleY, scaleZ);
             });
             
             // Update scale inputs when voxel is selected
             window.addEventListener('voxel-selected', function(e) {
                 const voxel = e.detail;
                 if (voxel) {
                     document.getElementById('scale-x').value = voxel.scale ? voxel.scale[0] : 1;
                     document.getElementById('scale-y').value = voxel.scale ? voxel.scale[1] : 1;
                     document.getElementById('scale-z').value = voxel.scale ? voxel.scale[2] : 1;
                     document.getElementById('scale-panel').style.display = 'block';
                 } else {
                     document.getElementById('scale-panel').style.display = 'none';
                 }
             });
         }
         
        scaleSelectedVoxel(scaleX, scaleY, scaleZ) {
            if (!this.selectedVoxel) return false;
            
            const voxel = this.getVoxelAt(this.selectedVoxel.x, this.selectedVoxel.y, this.selectedVoxel.z);
            if (!voxel) return false;
            
            // Store old values for undo
            const oldScale = voxel.scale ? [...voxel.scale] : [1, 1, 1];
            
            // Apply new scale
            voxel.scale = [scaleX, scaleY, scaleZ];
            
            // Update the InstancedMesh matrix
            const materialName = voxel.material;
            const mesh = this.instancedMeshes.get(materialName);
            if (mesh) {
                const key = this._gridKey(this.selectedVoxel);
                const instanceId = this.keyToInstance.get(materialName).get(key);
                if (instanceId !== undefined) {
                    this._setInstanceMatrix(mesh, instanceId, this._worldPos(this.selectedVoxel), 
                                           new THREE.Vector3(scaleX, scaleY, scaleZ));
                }
            }
            
            // Push to history for undo/redo
            this._pushHistory({ 
                type: 'scale', 
                x: this.selectedVoxel.x, 
                y: this.selectedVoxel.y, 
                z: this.selectedVoxel.z,
                oldScale: oldScale,
                newScale: [scaleX, scaleY, scaleZ]
            });
            
            this._onVoxelChanged();
            this._notify(`Voxel scaled: ${scaleX}x ${scaleY}y ${scaleZ}z`, 'success');
            return true;
        }
   
       _gridPos(worldPos) {
         return {
           x: Math.round(worldPos.x / this.voxelSize),
           y: Math.round(worldPos.y / this.voxelSize),
           z: Math.round(worldPos.z / this.voxelSize),
         };
       }
   
       _gridKey(v) {
         return v.x + ',' + v.y + ',' + v.z;
       }
   
       _worldPos(gridPos) {
         return new THREE.Vector3(
           gridPos.x * this.voxelSize,
           gridPos.y * this.voxelSize,
           gridPos.z * this.voxelSize
         );
       }
   
       // ── Raycast with InstancedMesh and ground plane support ───────────────────────
   
       _raycast(event) {
         const canvas = this.renderer.domElement;
         const rect = canvas.getBoundingClientRect();
         this.pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
         this.pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
   
         this.raycaster.setFromCamera(this.pointer, this.camera);
   
          // 1. Check voxels first (InstancedMesh)
          const meshes = Array.from(this.instancedMeshes.values());
          if (meshes.length > 0) {
            const intersects = this.raycaster.intersectObjects(meshes, false);
            if (intersects.length > 0) {
              const hit = intersects[0];
              if (hit.instanceId !== undefined) {
                const materialName = hit.object.material.name;
                const key = this.instanceToKey.get(materialName)?.[hit.instanceId];
                if (key) {
                  const parts = key.split(',').map(Number);
                  return { key, x: parts[0], y: parts[1], z: parts[2], point: hit.point, faceNormal: hit.face.normal, isGround: false };
                }
              }
            }
           }
   
          // 2. If no voxel hit, check ground plane
          // force recursive=false so ground plane is tested even if frustum-culled
          const groundIntersects = this.raycaster.intersectObject(this.groundPlane, false);
          if (groundIntersects.length > 0) {
          const p = groundIntersects[0].point;
          return {
            x: Math.round(p.x),
            y: 0,
            z: Math.round(p.z),
            point: p,
            faceNormal: new THREE.Vector3(0, 1, 0),
            isGround: true,
          };
        }
   
         return null;
       }
   
       _onPointerMove(event) {
         const hit = this._raycast(event);
         this.highlight.visible = false;
         this.ghost.visible = false;
   
         if (!hit) return;
   
         if (!hit.isGround) {
           // Voxel hit: always update highlight position
           this.highlight.position.copy(this._worldPos({ x: hit.x, y: hit.y, z: hit.z }));
           this.highlight.visible = true;
   
           if (this.activeTool === 'add') {
             const ghostPos = {
               x: hit.x + Math.round((hit.faceNormal || {x:0,y:0,z:1}).x),
               y: hit.y + Math.round((hit.faceNormal || {x:0,y:0,z:1}).y),
               z: hit.z + Math.round((hit.faceNormal || {x:0,y:0,z:1}).z),
             };
             this.ghost.position.copy(this._worldPos(ghostPos));
             this.ghost.visible = true;
           }
         } else {
           // Ground hit: show ghost when adding, otherwise nothing to show
           if (this.activeTool === 'add') {
             const ghostPos = { x: hit.x, y: 0.5, z: hit.z };
             this.ghost.position.copy(this._worldPos(ghostPos));
             this.ghost.visible = true;
           }
         }
       }
   
       _onPointerClick(event) {
         if (event.button !== 0) return;
         const hit = this._raycast(event);
         if (!hit) return;
         
         // In scaling mode, let the scaling tool handle click-selection
         if (this.activeTool === 'scaling') {
           return; // Scaling tool handles click directly
         }
   
         if (this.activeTool === 'add') {
           const pos = {
             x: hit.x + Math.round((hit.faceNormal || {x:0,y:0,z:1}).x),
             y: hit.y + Math.round((hit.faceNormal || {x:0,y:0,z:1}).y),
             z: hit.z + Math.round((hit.faceNormal || {x:0,y:0,z:1}).z),
           };
           this.addVoxel(pos, this.activeMaterial, this.activeModule);
         } else if (this.activeTool === 'remove') {
           this.removeVoxel(hit.x, hit.y, hit.z);
         } else if (this.activeTool === 'select') {
           this.selectVoxel(hit.x, hit.y, hit.z);
         }
       }
   
       _onKeyDown(event) {
         const tag = event.target.tagName;
         if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
   
         const key = event.key.toLowerCase();
         if (key === 'v') {
           this.setTool('select');
         } else if (key === 's') {
           this.setTool('scaling');
         } else if (key === 'a') {
           this.setTool('add');
         } else if (key === 'r') {
           this.setTool('remove');
         } else if (key === 'f') {
           this.setTool('fill');
         } else if (event.ctrlKey && key === 'x') {
           this.clearAll();
         } else if (event.ctrlKey && key === 'z') {
           this.undo();
         } else if (event.ctrlKey && key === 'y') {
           this.redo();
         }
       }
   
       // ── Voxel operations ─────────────────────────────────────────
   
        addVoxel(pos, materialName, moduleId) {
          if (moduleId === undefined) moduleId = null;
          const chunkKey = this._getChunkKey(pos);
          const localKey = this._getLocalKey(pos);
   
          const chunk = this._getOrCreateChunk(chunkKey);
          const existing = chunk.getVoxel(localKey.x, localKey.y, localKey.z);
          
          if (existing) {
            if (existing.material !== materialName) {
              this._removeVoxelSilently(existing.x, existing.y, existing.z);
              return this._addVoxelInternal(pos, materialName, moduleId);
            }
            return false;
          }
   
          return this._addVoxelInternal(pos, materialName, moduleId);
        }
   
          _addVoxelInternal(pos, materialName, moduleId) {
              const material = this.materialDB.get(materialName);
              if (!material) return false;
   
              const key = this._gridKey(pos);
              const voxelData = {
                x: pos.x, y: pos.y, z: pos.z,
                material: materialName,
                module: moduleId,
                density: material.density,
                temperature: 293,
                damage: 0,
                scale: [1, 1, 1] // Default scale: 1x1x1
              };
   
              // Add voxel to chunk
              const chunkKey = this._getChunkKey(pos);
              const localKey = this._getLocalKey(pos);
              const chunk = this._getOrCreateChunk(chunkKey);
              chunk.addVoxel(localKey.x, localKey.y, localKey.z, voxelData);
   
              const mesh = this._getInstancedMesh(materialName);
              if (!mesh) return false;
   
              const instanceId = this._getInstanceId(materialName);
              this._setInstanceMatrix(mesh, instanceId, this._worldPos(pos), voxelData.scale);
   
              this.keyToInstance.get(materialName).set(key, instanceId);
              this.instanceToKey.get(materialName)[instanceId] = key;
   
              // Update instance count to ensure voxel is rendered
              if (instanceId + 1 > mesh.count) {
                mesh.count = instanceId + 1;
              }
   
            this._pushHistory({ type: 'add', x: pos.x, y: pos.y, z: pos.z, material: materialName, module: moduleId });
            this._onVoxelChanged();
            return voxelData;
          }
   
        removeVoxel(x, y, z) {
          const chunkKey = this._getChunkKey({ x, y, z });
          const localKey = this._getLocalKey({ x, y, z });
          const chunk = this.chunks.get(chunkKey);
          if (!chunk) return;
          const voxel = chunk.getVoxel(localKey.x, localKey.y, localKey.z);
          if (!voxel) return;
   
          this._pushHistory({ type: 'remove', x, y, z, material: voxel.material, module: voxel.module });
          this._removeVoxelSilently(x, y, z);
          this._onVoxelChanged();
        }
   
       fillLayer(y, materialName, moduleId, solid = false) {
         if (moduleId === undefined) moduleId = null;
         let added = 0;
         const radius = 5;
         for (let x = -radius; x <= radius; x++) {
           for (let z = -radius; z <= radius; z++) {
             if (solid || x === -radius || x === radius || z === -radius || z === radius) {
               if (this.addVoxel({ x, y, z }, materialName, moduleId)) added++;
             }
           }
         }
         return added;
       }
   
   selectVoxel(x, y, z) {
     this.selectedVoxel = { x, y, z };
     const voxel = this.getVoxelAt(x, y, z);
     if (voxel) {
       this.highlight.position.copy(this._worldPos(voxel));
       this.highlight.visible = true;
     }
     window.dispatchEvent(new CustomEvent('voxel-selected', { detail: voxel || null }));
     return voxel;
   }
   
        getVoxelAt(x, y, z) {
          const chunkKey = this._getChunkKey({ x, y, z });
          const localKey = this._getLocalKey({ x, y, z });
          const chunk = this.chunks.get(chunkKey);
          if (!chunk) return null;
          return chunk.getVoxel(localKey.x, localKey.y, localKey.z);
        }
   
    getVoxelsInModule(moduleId) {
      const result = [];
      for (const chunk of this.chunks.values()) {
        for (const {x, y, z, voxelData} of chunk.voxelsIterator()) {
          if (voxelData.module === moduleId) {
            result.push(voxelData);
          }
        }
      }
      return result;
    }

    *voxelsIterator() {
      for (const chunk of this.chunks.values()) {
        for (const {x, y, z, voxelData} of chunk.voxelsIterator()) {
          yield { x, y, z, material: voxelData.material, density: voxelData.density };
        }
      }
    }
   
   // ── Internal remove (without history push) ───────────────────

   _removeVoxelSilently(x, y, z) {
     const chunkKey = this._getChunkKey({ x, y, z });
     const localKey = this._getLocalKey({ x, y, z });
     const chunk = this.chunks.get(chunkKey);
     if (!chunk) return;
     const voxel = chunk.getVoxel(localKey.x, localKey.y, localKey.z);
     if (!voxel) return;

     const worldKey = this._gridKey({ x, y, z });
     const matName = voxel.material;
     const instMap = this.keyToInstance.get(matName);
     const idxMap = this.instanceToKey.get(matName);
     const mesh = this.instancedMeshes.get(matName);

     if (instMap && idxMap && mesh) {
       const instanceId = instMap.get(worldKey);
       if (instanceId !== undefined) {
         const hiddenMatrix = new THREE.Matrix4();
         hiddenMatrix.makeScale(0, 0, 0);
         mesh.setMatrixAt(instanceId, hiddenMatrix);
         mesh.instanceMatrix.needsUpdate = true;

         instMap.delete(worldKey);
         idxMap[instanceId] = null;
         this.freeIndices.get(matName)?.push(instanceId);
       }
     }
     chunk.removeVoxel(localKey.x, localKey.y, localKey.z);
     // Optional: if chunk becomes empty, we could remove it to save memory, but not required.
   }
   
       // ── Undo / Redo ──────────────────────────────────────────────
   
        clearAll() {
          for (const [matName, mesh] of this.instancedMeshes) {
            const identity = new THREE.Matrix4();
            for (let i = 0; i < mesh.count; i++) {
              mesh.setMatrixAt(i, identity);
            }
            mesh.count = 0;
            mesh.instanceMatrix.needsUpdate = true;
          }
   
          const free = [];
          for (const [matName] of this.instancedMeshes) {
            this.keyToInstance.get(matName)?.clear();
            this.instanceToKey.set(matName, new Array(this.maxInstances).fill(null));
            free.length = 0;
          }
   
          this.chunks.clear();
          this.selectedVoxel = null;
          this.clearHistory();
          this._onVoxelChanged();
        }
   
       setTool(tool) {
         this.activeTool = tool;
         
         // Activate/deactivate scaling tool
         if (this.scalingTool) {
           if (tool === 'scaling') {
             this.scalingTool.activate();
           } else {
             this.scalingTool.deactivate();
           }
         }
         
         const btns = document.querySelectorAll('.tool');
         for (let i = 0; i < btns.length; i++) btns[i].classList.remove('active');
         const btnMap = { select: 'tool-select', add: 'tool-add', remove: 'tool-remove', fill: 'tool-fill', scaling: 'tool-scaling' };
         const el = document.getElementById(btnMap[tool]);
         if (el) el.classList.add('active');
         window.dispatchEvent(new CustomEvent('tool-changed', { detail: tool }));
       }
   
       _pushHistory(action) {
         this._history.push(action);
         if (this._history.length > this._maxHistory) this._history.shift();
         this._redoStack = [];
       }
   
       _pushRedo(action) {
         this._redoStack.push(action);
         if (this._redoStack.length > this._maxRedo) this._redoStack.shift();
       }
   
         undo() {
             if (this._history.length === 0) return;
             const action = this._history.pop();
             this._pushRedo(action);
             if (action.type === 'add') {
                 this._removeVoxelSilently(action.x, action.y, action.z);
             } else if (action.type === 'remove') {
                 this._addVoxelInternal({ x: action.x, y: action.y, z: action.z }, action.material, action.module);
             } else if (action.type === 'scale') {
                 // Revert to old scale
                 const voxel = this.getVoxelAt(action.x, action.y, action.z);
                 if (voxel) {
                     this._applyVoxelScaleToVoxel(voxel, action.oldScale[0], action.oldScale[1], action.oldScale[2]);
                 }
             }
             this._onVoxelChanged();
         }
   
         redo() {
             if (this._redoStack.length === 0) return;
             const action = this._redoStack.pop();
             this._pushHistory(action);
             if (action.type === 'add') {
                 this._addVoxelInternal({ x: action.x, y: action.y, z: action.z }, action.material, action.module);
             } else if (action.type === 'remove') {
                 this._removeVoxelSilently(action.x, action.y, action.z);
             } else if (action.type === 'scale') {
                 // Apply the new scale again
                 const voxel = this.getVoxelAt(action.x, action.y, action.z);
                 if (voxel) {
                     this._applyVoxelScaleToVoxel(voxel, action.newScale[0], action.newScale[1], action.newScale[2]);
                 }
             }
             this._onVoxelChanged();
         }
   
       clearHistory() {
         this._history = [];
         this._redoStack = [];
       }
   
       // ── Persistence ──────────────────────────────────────────────
   
    toJSON() {
      const voxels = [];
      for (const chunk of this.chunks.values()) {
        for (const {x, y, z, voxelData} of chunk.voxelsIterator()) {
          voxels.push({
            x: x,
            y: y,
            z: z,
            material: voxelData.material,
            module: voxelData.module,
            scale: voxelData.scale || [1, 1, 1],
            temperature: voxelData.temperature,
            damage: voxelData.damage
          });
        }
      }
      return {
        voxels,
        modules: this.moduleSystem.toJSON(),
        version: '0.3.0'
      };
    }
   
   fromJSON(data) {
     this.clearAll();

     if (!data || typeof data !== 'object') {
       console.error('[VoxelEngine] Invalid JSON data');
       return;
     }

     if (data.modules) this.moduleSystem.fromJSON(data.modules);
     const voxels = data.voxels || [];
     if (!Array.isArray(voxels)) {
       console.error('[VoxelEngine] voxels must be an array');
       return;
     }

     let loaded = 0;
     for (let i = 0; i < voxels.length; i++) {
       const v = voxels[i];
       if (!v || typeof v.x !== 'number' || typeof v.y !== 'number' || typeof v.z !== 'number' || !v.material) {
         console.warn('[VoxelEngine] Skipping invalid voxel at index', i);
         continue;
       }
       const key = this._gridKey(v);
       // Check if voxel already exists in chunk system
       const existingVoxel = this.getVoxelAt(v.x, v.y, v.z);
       if (existingVoxel) {
         continue;
       }

       const voxelData = this._addVoxelInternal({ x: v.x, y: v.y, z: v.z }, v.material, v.module);
       
       // Restore scale if present
       if (voxelData && v.scale) {
         voxelData.scale = v.scale;
         const materialName = voxelData.material;
         const mesh = this.instancedMeshes.get(materialName);
         if (mesh) {
           const instMap = this.keyToInstance.get(materialName);
           const instanceId = instMap?.get(key);
           if (instanceId !== undefined) {
             this._setInstanceMatrix(
               mesh, 
               instanceId, 
               this._worldPos({ x: v.x, y: v.y, z: v.z }),
               new THREE.Vector3(v.scale[0], v.scale[1], v.scale[2])
             );
           }
         }
       }

       loaded++;
     }
     this._onVoxelChanged();
     console.log(`[VoxelEngine] Loaded ${loaded} voxels from JSON`);
   }
   
       resetCamera() {
         if (!this.controls) return;
         this.camera.position.set(8, 10, 12);
         this.camera.lookAt(0, 0, 0);
         this.controls.target.set(0, 0, 0);
         this.controls.update();
       }
   
   // Get total number of voxels across all chunks
   getVoxelCount() {
     let total = 0;
     for (const chunk of this.chunks.values()) {
       total += chunk.size();
     }
     return total;
   }

   _onVoxelChanged() {
     try {
       const el = document.getElementById('voxel-count');
       if (el) el.textContent = 'Voxel: ' + this.getVoxelCount();
       window.dispatchEvent(new CustomEvent('voxels-updated', { detail: { count: this.getVoxelCount() } }));
     } catch (e) {
       // silently ignore
     }
   }
   
         update(deltaTime) {
           if (this.ghost && this.ghost.visible) {
             this.ghost.material.opacity = 0.2 + Math.sin(performance.now() * 0.005) * 0.1;
           }
         }
    }

    class Chunk {
     constructor(chunkX, chunkY, chunkZ, chunkSize) {
       this.chunkX = chunkX;
       this.chunkY = chunkY;
       this.chunkZ = chunkZ;
       this.chunkSize = chunkSize;
       this.voxels = new Map(); // localKey -> voxelData
     }
   
     getVoxel(localX, localY, localZ) {
       const key = `${localX},${localY},${localZ}`;
       return this.voxels.get(key);
     }
   
     addVoxel(localX, localY, localZ, voxelData) {
       const key = `${localX},${localY},${localZ}`;
       this.voxels.set(key, voxelData);
     }
   
     removeVoxel(localX, localY, localZ) {
       const key = `${localX},${localY},${localZ}`;
       return this.voxels.delete(key);
     }
   }