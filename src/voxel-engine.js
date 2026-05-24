/**
 * VoxelEngine - Manages the 3D grid, rendering and voxel interaction
 *
 * Uses InstancedMesh for material — a single draw call per material
 * instead of one per voxel. Improvement: ~10-50x with large scenes.
 */
// Import dinamico: permette al test runner di iniettare un mock prima del caricamento
import * as THREE from 'three';
import { Chunk } from './core/chunk-system.js';
import { ScalingTool } from './core/scaling-tool.js';
import { SculptTool } from './core/sculpt-tool.js';
import { VertexEditTool } from './core/vertex-edit-tool.js';
import { MoveTool } from './core/move-tool.js';

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

        this.voxelSize = 1.0;

        this.ghost = null;
        this._createGhost();

        this.highlight = null;
        this._createHighlight();

        this.sharedGeometry = new THREE.BoxGeometry(this.voxelSize, this.voxelSize, this.voxelSize);

        this._createAxisLabels();

        // Invisible ground plane for raycasting (first voxel)
        const groundGeo = new THREE.PlaneGeometry(200, 200);
        groundGeo.rotateX(-Math.PI / 2);
        const groundMat = new THREE.MeshBasicMaterial({ 
          visible: false,
          depthWrite: false,
          color: 0xffffff,
          // Make sure raycasting works even with invisible material
          toneMapped: false 
        });
        this.groundPlane = new THREE.Mesh(groundGeo, groundMat);
        this.groundPlane.position.y = 0; // Ensure it's at y=0
        this.groundPlane.frustumCulled = false; // always test in raycasting
        this.scene.add(this.groundPlane);

        this.raycaster = new THREE.Raycaster();
        this.pointer = new THREE.Vector2();

        this.selectedVoxel = null;
        this.activeMaterial = 'steel';
        this.activeModule = null;
        this.activeTool = 'add';
        this.cameraNavigationMode = false;

        this._history = [];
        this._redoStack = [];
        this._maxHistory = 50;
        this._maxRedo = 50;

         this._setupEvents();
         this._setupScalePanelListeners();
         
         // Initialize ScalingTool
         this.scalingTool = new ScalingTool(this, this.scene, this.camera, this.renderer);
         
         // Initialize SculptTool
         this.sculptTool = new SculptTool(this, this.scene, this.camera, this.renderer);
         
          // Initialize VertexEditTool
          this.vertexEditTool = new VertexEditTool(this, this.scene, this.camera, this.renderer);

          // Initialize MoveTool
          this.moveTool = new MoveTool(this, this.scene, this.camera, this.renderer);
    }

    _setupEvents() {
        const canvas = this.renderer.domElement;
        canvas.addEventListener('pointermove', (e) => this._onPointerMove(e));
        canvas.addEventListener('click', (e) => {
            this._onPointerClick(e);
            // Prevent OrbitControls from handling this click
            e.stopPropagation();
        });
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
        // Apply vertex edit (confirm button)
        document.getElementById('btn-vertex-apply').addEventListener('click', function() {
            if (!self.vertexEditTool || !self.vertexEditTool.selectedVoxel) {
                self._notify('Seleziona un brick per la modifica vertici', 'warn');
                return;
            }
            var v = self.vertexEditTool.selectedVoxel;
            var d = self.getVoxelAt(v.x, v.y, v.z);
            if (d && d.scale) {
                document.getElementById('vertex-size-label').textContent =
                    'W: ' + d.scale[0].toFixed(1) + ' | H: ' +
                    d.scale[1].toFixed(1) + ' | D: ' +
                    d.scale[2].toFixed(1);
            }
            self._notify('Modifica vertici confermata', 'success');
        });
        // Update scale inputs when voxel is selected (also sync vertex-edit panel)
        window.addEventListener('voxel-selected', function(e) {
            const voxel = e.detail;
            if (voxel) {
                document.getElementById('scale-x').value = voxel.scale ? voxel.scale[0] : 1;
                document.getElementById('scale-y').value = voxel.scale ? voxel.scale[1] : 1;
                document.getElementById('scale-z').value = voxel.scale ? voxel.scale[2] : 1;
                document.getElementById('scale-panel').style.display = 'block';
                // Sync vertex-edit panel label when in vertexEdit mode
                if (self.activeTool === 'vertexEdit' && self.vertexEditTool && self.vertexEditTool.selectedVoxel) {
                    var sv = self.vertexEditTool.selectedVoxel;
                    var sd = self.getVoxelAt(sv.x, sv.y, sv.z);
                    if (sd && sd.scale) {
                        var lbl = document.getElementById('vertex-size-label');
                        if (lbl) lbl.textContent =
                            'W: ' + sd.scale[0].toFixed(1) + ' | H: ' +
                            sd.scale[1].toFixed(1) + ' | D: ' +
                            sd.scale[2].toFixed(1);
                    }
                }
            } else {
                document.getElementById('scale-panel').style.display = 'none';
                document.getElementById('vertex-edit-panel').style.display = 'none';
            }
        });
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
         mesh.count = 0;
         mesh.castShadow = true;
         mesh.receiveShadow = true;
         mesh.frustumCulled = false; // Disable to avoid bounding volume recalculations
         mesh.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 9999999); // Giant sphere to bypass recalculation on raycast
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
                const normalizedScale = Array.isArray(scale)
                  ? new THREE.Vector3(scale[0] || 1, scale[1] || 1, scale[2] || 1)
                  : new THREE.Vector3(scale?.x || 1, scale?.y || 1, scale?.z || 1);
                const matrix = new THREE.Matrix4();
                matrix.makeScale(normalizedScale.x, normalizedScale.y, normalizedScale.z);
               // Apply translation after scale
               matrix.elements[12] = position.x;
               matrix.elements[13] = position.y;
               matrix.elements[14] = position.z;
               mesh.setMatrixAt(instanceId, matrix);
               mesh.instanceMatrix.needsUpdate = true;
           }

        _applyVoxelScaleToVoxel(voxel, scaleX, scaleY, scaleZ, newCenter) {
              // Update voxel data
              voxel.scale = [scaleX, scaleY, scaleZ];

              // Update InstancedMesh — use provided center or fall back to computed world pos
              const materialName = voxel.material;
              const mesh = this.instancedMeshes.get(materialName);
              if (mesh) {
                  const key = this._gridKey({ x: voxel.x, y: voxel.y, z: voxel.z });
                  const instanceId = this.keyToInstance.get(materialName).get(key);
                  if (instanceId !== undefined) {
                      const worldCenter = newCenter
                          ? new THREE.Vector3(newCenter.x, newCenter.y, newCenter.z)
                          : this._worldPos({ x: voxel.x, y: voxel.y, z: voxel.z });
                      this._setInstanceMatrix(mesh, instanceId, worldCenter,
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
            transparent: true,
            opacity: 0.8,
          });
          this.highlight = new THREE.LineSegments(edges, mat);
          this.highlight.visible = false;
          this.scene.add(this.highlight);
        }
    
        scaleSelectedVoxel(scaleX, scaleY, scaleZ) {
            if (!this.selectedVoxel) return false;
            
            const voxel = this.getVoxelAt(this.selectedVoxel.x, this.selectedVoxel.y, this.selectedVoxel.z);
            if (!voxel) return false;
            
            // Store old values for undo
            const oldScale = voxel.scale ? [...voxel.scale] : [1, 1, 1];
            
            // Apply new scale
            voxel.scale = [scaleX, scaleY, scaleZ];
            
            if (this.highlight && this.highlight.visible) {
                this.highlight.scale.set(scaleX, scaleY, scaleZ);
            }
            
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
           x: Math.floor(worldPos.x / this.voxelSize),
           y: Math.floor(worldPos.y / this.voxelSize),
           z: Math.floor(worldPos.z / this.voxelSize),
          };
       }
   
       _gridKey(v) {
         return v.x + ',' + v.y + ',' + v.z;
       }
   
       _worldPos(gridPos) {
         return new THREE.Vector3(
           (gridPos.x + 0.5) * this.voxelSize,
           (gridPos.y + 0.5) * this.voxelSize,
           (gridPos.z + 0.5) * this.voxelSize
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
                       if (this.getVoxelAt(parts[0], parts[1], parts[2])) {
                         // Extract face normal safely - InstancedMesh raycast may not provide it
                         let faceNormal = new THREE.Vector3(0, 1, 0);
                         if (hit.face && hit.face.normal) {
                           faceNormal = hit.face.normal.clone();
                         }
                         return { key, x: parts[0], y: parts[1], z: parts[2], point: hit.point, faceNormal, isGround: false };
                       }
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
            x: Math.floor(p.x / this.voxelSize),
            y: 0,
            z: Math.floor(p.z / this.voxelSize),
            point: p,
            faceNormal: new THREE.Vector3(0, 1, 0),
            isGround: true,
          };
        }
   
         return null;
       }
   
        _onPointerMove(event) {
          if (this.cameraNavigationMode) {
            this.highlight.visible = false;
            this.ghost.visible = false;
            return;
          }

          const hit = this._raycast(event);

          if (!hit) {
            this.highlight.visible = false;
            this.ghost.visible = false;
            return;
          }

          this.highlight.visible = false;
          this.ghost.visible = false;

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
             // Ground hit: show ghost when adding, or highlight an existing voxel while removing/selecting.
              if (this.activeTool === 'add') {
                const ghostPos = { x: hit.x, y: 0, z: hit.z };
                this.ghost.position.copy(this._worldPos(ghostPos));
                this.ghost.visible = true;
              } else if (this.activeTool === 'remove' || this.activeTool === 'select') {
                const target = this.getVoxelAt(hit.x, 0, hit.z) || this.getVoxelAt(hit.x, 1, hit.z);
                if (target) {
                  this.highlight.position.copy(this._worldPos(target));
                  this.highlight.visible = true;
                }
              }
            }
         }

         _onPointerClick(event) {
             if (event.button !== 0) return;
             if (this.cameraNavigationMode) return;
             const hit = this._raycast(event);
             if (!hit) return;

              // In move mode, let the move tool handle everything
              if (this.activeTool === 'move') {
                if (!this.moveTool.isDragging) return; // button release not handled by engine
              }

              // In scaling mode, let the scaling tool handle click-selection
             if (this.activeTool === 'scaling') {
               return; // Scaling tool handles click directly
             }

             // In vertexEdit mode, let the vertexEdit tool handle click-selection
             if (this.activeTool === 'vertexEdit') {
               return; // VertexEdit tool handles click directly
             }
    
            if (this.activeTool === 'add') {
              let pos;
              if (hit.isGround) {
                pos = { x: hit.x, y: 0, z: hit.z };
              } else {
                pos = {
                  x: hit.x + Math.round((hit.faceNormal || {x:0,y:0,z:1}).x),
                  y: hit.y + Math.round((hit.faceNormal || {x:0,y:0,z:1}).y),
                  z: hit.z + Math.round((hit.faceNormal || {x:0,y:0,z:1}).z),
                };
              }
             const result = this.addVoxel(pos, this.activeMaterial, this.activeModule);
             if (result) {
               this._notify(`Voxel added: (${pos.x}, ${pos.y}, ${pos.z})`, 'success');
             }
} else if (this.activeTool === 'remove') {
            // When clicking ground, try y=0 first then fallback to y=1 for legacy voxels
            if (hit.isGround) {
              let removed = this.removeVoxel(hit.x, 0, hit.z);
              if (!removed) {
                removed = this.removeVoxel(hit.x, 1, hit.z);
              }
              if (removed) {
                this._notify('Voxel removed', 'success');
              } else {
                this._notify('No voxel to remove at this position', 'warn');
              }
            } else {
              if (this.removeVoxel(hit.x, hit.y, hit.z)) {
                this._notify('Voxel removed', 'success');
              } else {
                this._notify('No voxel to remove at this position', 'warn');
              }
            }
          } else if (this.activeTool === 'select') {
            this.selectVoxel(hit.x, hit.y, hit.z);
          } else if (this.activeTool === 'cylinder') {
            const pos = hit.isGround ? { x: hit.x, y: 25, z: hit.z } : { x: hit.x, y: hit.y, z: hit.z };
            const count = this.addCylinder(pos, 20, 50, this.activeMaterial);
            this._notify(`Cilindro creato: ${count.length} voxel`, 'success');
          } else if (this.activeTool === 'cone') {
            const pos = hit.isGround ? { x: hit.x, y: 25, z: hit.z } : { x: hit.x, y: hit.y, z: hit.z };
            const count = this.addCone(pos, 20, 50, this.activeMaterial);
            this._notify(`Cono creato: ${count.length} voxel`, 'success');
          } else if (this.activeTool === 'sphere') {
            const pos = hit.isGround ? { x: hit.x, y: 20, z: hit.z } : { x: hit.x, y: hit.y, z: hit.z };
            const count = this.addSphere(pos, 40, this.activeMaterial);
            this._notify(`Sfera creata: ${count.length} voxel`, 'success');
          }
        }
   
       _onKeyDown(event) {
         const tag = event.target.tagName;
         if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
   
         const key = event.key.toLowerCase();
          if (key === '0' || key === 'home') {
            this.resetCamera();
          } else if (key === '1') {
            this.setCameraView('front');
          } else if (key === '3') {
            this.setCameraView('right');
          } else if (key === '7') {
            this.setCameraView('top');
          } else if (key === 'c') {
            this.setCameraNavigationMode(!this.cameraNavigationMode);
          } else if (key === '+' || key === '=' || key === 'pageup') {
            this.zoomCamera(0.82);
          } else if (key === '-' || key === '_' || key === 'pagedown') {
            this.zoomCamera(1.22);
          } else if (key === 'v') {
            this.setTool('select');
          } else if (key === 's') {
            this.setTool('scaling');
         } else if (key === 'a') {
           this.setTool('add');
         } else if (key === 'r') {
           this.setTool('remove');
          } else if (key === 'f') {
            this.setTool('fill');
          } else if (key === 'd') {
            this.setTool('sculpt');
          } else if (key === 'e') {
            this.setTool('vertexEdit');
         } else if (event.ctrlKey && key === 'x') {
           this.clearAll();
           } else if (event.ctrlKey && key === 'z') {
             this.undo();
           } else if (event.ctrlKey && key === 'y') {
             this.redo();
           } else if (key === 'm') {
             this.setTool('move');
           }
       }
        // ── Voxel operations ─────────────────────────────────────────

        addVoxel(pos, materialName, moduleId) {
          if (moduleId === undefined) moduleId = null;
            const chunkKey = this._getChunkKey(pos);
            const chunk = this._getOrCreateChunk(chunkKey);
            const existing = chunk.getVoxel(pos.x, pos.y, pos.z);

            if (existing) {
              // Voxel already present: update material only if changed, otherwise no-op
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
             scale: [1, 1, 1]
           };

const chunkKey = this._getChunkKey(pos);
            const chunk = this._getOrCreateChunk(chunkKey);
           chunk.addVoxel(pos.x, pos.y, pos.z, voxelData);

          const mesh = this._getInstancedMesh(materialName);
          if (!mesh) return false;

          const instanceId = this._getInstanceId(materialName);
          this._setInstanceMatrix(mesh, instanceId, this._worldPos(pos), voxelData.scale);

          this.keyToInstance.get(materialName).set(key, instanceId);
          this.instanceToKey.get(materialName)[instanceId] = key;

          if (instanceId + 1 > mesh.count) {
            mesh.count = instanceId + 1;
          }

          this._pushHistory({ type: 'add', x: pos.x, y: pos.y, z: pos.z, material: materialName, module: moduleId });
          this._onVoxelChanged();
          return voxelData;
        }

        removeVoxel(x, y, z) {
            const chunkKey = this._getChunkKey({ x, y, z });
            const chunk = this.chunks.get(chunkKey);
            if (!chunk) return false;
            const voxel = chunk.getVoxel(x, y, z);
            if (!voxel) return false;

            this._pushHistory({ type: 'remove', x, y, z, material: voxel.material, module: voxel.module });
            this._removeVoxelSilently(x, y, z);
            this._onVoxelChanged();
            return true;
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
           const chunk = this.chunks.get(chunkKey);
           if (!chunk) return null;
           return chunk.getVoxel(x, y, z);
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
          yield { x, y, z, material: voxelData.material, density: voxelData.density, scale: voxelData.scale };
        }
      }
    }

       // ── Internal remove (without history push) ───────────────────

        _removeVoxelSilently(x, y, z) {
            const chunkKey = this._getChunkKey({ x, y, z });
            const chunk = this.chunks.get(chunkKey);
            if (!chunk) return;
            const voxel = chunk.getVoxel(x, y, z);
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
                hiddenMatrix.makeTranslation(0, -999999, 0); // Move far away with scale 1 to prevent NaN normals
                mesh.setMatrixAt(instanceId, hiddenMatrix);
                mesh.instanceMatrix.needsUpdate = true;

          instMap.delete(worldKey);
          idxMap[instanceId] = null;
          this.freeIndices.get(matName)?.push(instanceId);
              }
            }
            chunk.removeVoxel(x, y, z);
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

          for (const [matName] of this.instancedMeshes) {
            this.keyToInstance.get(matName)?.clear();
            this.instanceToKey.set(matName, new Array(this.maxInstances).fill(null));
            this.freeIndices.set(matName, []);
          }

          this.chunks.clear();
          this.selectedVoxel = null;
          this.clearHistory();
          this._onVoxelChanged();
        }
   
        setTool(tool) {
          this.setCameraNavigationMode(false);
          this.activeTool = tool;
          
          // Activate/deactivate scaling tool
          if (this.scalingTool) {
            if (tool === 'scaling') {
              this.scalingTool.activate();
            } else {
              this.scalingTool.deactivate();
            }
          }
          
          // Activate/deactivate sculpt tool
          if (this.sculptTool) {
            if (tool === 'sculpt') {
              this.sculptTool.activate();
            } else {
              this.sculptTool.deactivate();
            }
          }
          
           // Activate/deactivate vertex edit tool
           if (this.vertexEditTool) {
             if (tool === 'vertexEdit') {
               this.vertexEditTool.activate();
             } else {
               this.vertexEditTool.deactivate();
             }
           }
            // Activate/deactivate move tool
            if (this.moveTool) {
              if (tool === 'move') {
                this.moveTool.activate();
              } else {
                this.moveTool.deactivate();
              }
            }
            
             const btns = document.querySelectorAll('.tool');
             for (let i = 0; i < btns.length; i++) btns[i].classList.remove('active');
             const btnMap = { select: 'tool-select', add: 'tool-add', remove: 'tool-remove', fill: 'tool-fill', scaling: 'tool-scaling', sculpt: 'tool-sculpt', vertexEdit: 'tool-vertex-edit', cylinder: 'tool-cylinder', cone: 'tool-cone', sphere: 'tool-sphere', move: 'tool-move' };
          const el = document.getElementById(btnMap[tool]);
          if (el) el.classList.add('active');
          window.dispatchEvent(new CustomEvent('tool-changed', { detail: tool }));
        }

       setCameraNavigationMode(enabled) {
         this.cameraNavigationMode = !!enabled;

         if (this.controls) {
           if (!this.controls.mouseButtons) this.controls.mouseButtons = {};
           this.controls.mouseButtons.LEFT = this.cameraNavigationMode ? THREE.MOUSE.ROTATE : false;
           this.controls.mouseButtons.MIDDLE = THREE.MOUSE.PAN;
           this.controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
           this.controls.enableRotate = true;
           this.controls.enablePan = true;
           this.controls.enableZoom = true;
           this.controls.update();
         }

         if (this.cameraNavigationMode) {
           this.highlight.visible = false;
           this.ghost.visible = false;
         }

         window.dispatchEvent(new CustomEvent('camera-navigation-changed', { detail: this.cameraNavigationMode }));
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
                      const c = action.oldCenter ?
                          new THREE.Vector3(action.oldCenter.x, action.oldCenter.y, action.oldCenter.z) :
                          this._worldPos({ x: action.x, y: action.y, z: action.z });
                      this._applyVoxelScaleToVoxel(voxel, action.oldScale[0], action.oldScale[1], action.oldScale[2], c);
                  }
               } else if (action.type === 'vertexScale') {
                   const voxel = this.getVoxelAt(action.x, action.y, action.z);
                   if (voxel) {
                       const c = action.oldCenter ?
                           new THREE.Vector3(action.oldCenter.x, action.oldCenter.y, action.oldCenter.z) :
                           this._worldPos({ x: action.x, y: action.y, z: action.z });
                       this._applyVoxelScaleToVoxel(voxel, action.oldScale[0], action.oldScale[1], action.oldScale[2], c);
                   }
               } else if (action.type === 'move') {
                   // Undo: remove from new pos, restore to old pos
                   const moved = this.getVoxelAt(action.newX, action.newY, action.newZ);
                   if (moved) this._removeVoxelSilently(action.newX, action.newY, action.newZ);
                   this._addVoxelInternal(
                     { x: action.oldX, y: action.oldY, z: action.oldZ },
                     action.material, action.module
                   );
                   const restored = this.getVoxelAt(action.oldX, action.oldY, action.oldZ);
                   if (restored && action.scale) {
                       restored.scale = [...action.scale];
                       this._applyVoxelScaleToVoxel(restored, action.scale[0], action.scale[1], action.scale[2],
                         this._worldPos({ x: action.oldX, y: action.oldY, z: action.oldZ }));
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
                       const c = action.newCenter ?
                           new THREE.Vector3(action.newCenter.x, action.newCenter.y, action.newCenter.z) :
                           this._worldPos({ x: action.x, y: action.y, z: action.z });
                       this._applyVoxelScaleToVoxel(voxel, action.newScale[0], action.newScale[1], action.newScale[2], c);
                   }
               } else if (action.type === 'vertexScale') {
                   const voxel = this.getVoxelAt(action.x, action.y, action.z);
                   if (voxel) {
                       const c = action.newCenter ?
                           new THREE.Vector3(action.newCenter.x, action.newCenter.y, action.newCenter.z) :
                           this._worldPos({ x: action.x, y: action.y, z: action.z });
                       this._applyVoxelScaleToVoxel(voxel, action.newScale[0], action.newScale[1], action.newScale[2], c);
                   }
               } else if (action.type === 'move') {
                   // Redo: remove from old pos, re-add at new pos
                   const atOld = this.getVoxelAt(action.oldX, action.oldY, action.oldZ);
                   if (atOld) this._removeVoxelSilently(action.oldX, action.oldY, action.oldZ);
                   this._addVoxelInternal(
                     { x: action.newX, y: action.newY, z: action.newZ },
                     action.material, action.module
                   );
                   const restored = this.getVoxelAt(action.newX, action.newY, action.newZ);
                   if (restored && action.scale) {
                       restored.scale = [...action.scale];
                       this._applyVoxelScaleToVoxel(restored, action.scale[0], action.scale[1], action.scale[2],
                         this._worldPos({ x: action.newX, y: action.newY, z: action.newZ }));
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
   
       getVoxelBounds() {
         let minX = Infinity, minY = Infinity, minZ = Infinity;
         let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;
         let count = 0;

         for (const voxel of this.voxelsIterator()) {
           const scale = voxel.scale || [1, 1, 1];
           const sx = (scale[0] || 1) * this.voxelSize;
           const sy = (scale[1] || 1) * this.voxelSize;
           const sz = (scale[2] || 1) * this.voxelSize;
           const center = this._worldPos(voxel);

           minX = Math.min(minX, center.x - sx / 2);
           maxX = Math.max(maxX, center.x + sx / 2);
           minY = Math.min(minY, center.y - sy / 2);
           maxY = Math.max(maxY, center.y + sy / 2);
           minZ = Math.min(minZ, center.z - sz / 2);
           maxZ = Math.max(maxZ, center.z + sz / 2);
           count++;
         }

         if (count === 0) {
           return {
             min: new THREE.Vector3(-5, 0, -5),
             max: new THREE.Vector3(5, 3, 5),
             center: new THREE.Vector3(0, 1, 0),
             size: new THREE.Vector3(10, 3, 10),
             radius: 7
           };
         }

         const min = new THREE.Vector3(minX, minY, minZ);
         const max = new THREE.Vector3(maxX, maxY, maxZ);
         const center = new THREE.Vector3().addVectors(min, max).multiplyScalar(0.5);
         const size = new THREE.Vector3().subVectors(max, min);
         const radius = Math.max(size.length() * 0.5, this.voxelSize * 3);
         return { min, max, center, size, radius };
       }

       fitCameraToVoxels(direction = null) {
         if (!this.controls) return;

         const bounds = this.getVoxelBounds();
         const target = bounds.center;
         const fov = THREE.MathUtils.degToRad(this.camera.fov);
         const fitHeightDistance = bounds.radius / Math.sin(fov / 2);
         const fitWidthDistance = fitHeightDistance / Math.max(this.camera.aspect || 1, 0.1);
         const distance = Math.max(fitHeightDistance, fitWidthDistance) * 1.15;

         let viewDir = direction ? direction.clone() : new THREE.Vector3().subVectors(this.camera.position, this.controls.target);
         if (viewDir.lengthSq() < 0.0001) viewDir = new THREE.Vector3(0.55, 0.65, 0.75);
         viewDir.normalize();

         this.controls.target.copy(target);
         this.camera.position.copy(target).addScaledVector(viewDir, distance);
         this.camera.near = Math.max(0.01, distance / 500);
         this.camera.far = Math.max(2000, distance * 20);
         this.camera.updateProjectionMatrix();
         this.controls.minDistance = Math.max(0.25, bounds.radius * 0.08);
         this.controls.maxDistance = Math.max(50, bounds.radius * 12);
         this.controls.update();
       }

       setCameraView(view) {
         const directions = {
           iso: new THREE.Vector3(0.55, 0.65, 0.75),
           front: new THREE.Vector3(0, 0.12, 1),
           right: new THREE.Vector3(1, 0.12, 0),
           top: new THREE.Vector3(0, 1, 0.001)
         };
         this.fitCameraToVoxels(directions[view] || directions.iso);
       }

       zoomCamera(factor) {
         if (!this.controls || !this.camera) return;

         const target = this.controls.target || new THREE.Vector3();
         const offset = new THREE.Vector3().subVectors(this.camera.position, target);
         const minDistance = this.controls.minDistance || 0.25;
         const maxDistance = this.controls.maxDistance || 500;
         const nextDistance = THREE.MathUtils.clamp(offset.length() * factor, minDistance, maxDistance);

         if (offset.lengthSq() < 0.0001) offset.set(0.55, 0.65, 0.75);
         offset.normalize().multiplyScalar(nextDistance);
         this.camera.position.copy(target).add(offset);
         this.camera.updateProjectionMatrix();
         this.controls.update();
       }

       resetCamera() {
         this.setCameraView('iso');
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
      // Optimized: defer heavy count operations to prevent O(N^2) lag
      window.dispatchEvent(new CustomEvent('voxels-updated'));
    }

    // ── Notification helper (implementation lives in ui.js) ──────────────
    // VoxelEngine calls this; ui.js may override via prototype during init.
     _notify(message, level = 'info') {
         if (typeof window !== 'undefined' && window.dispatchEvent) {
             try { window.dispatchEvent(new window.CustomEvent('toast-notify', { detail: { message, level } })); } catch (_) { /* no toast infrastructure in tests */ }
         }
     }

     update(deltaTime) {
        if (this.ghost && this.ghost.visible) {
          // Cache performance.now() to avoid multiple calls
          const time = performance.now() * 0.006;
          this.ghost.material.opacity = 0.3 + Math.sin(time) * 0.15;
        }
      }

    // ── Voxel mutation helpers (called by BrickAdapter) ────────────────────────
    /**
     * Cambia materiale a un voxel esistente alle coordinate date.
     * @returns {boolean} true se voxel esisteva e materiale aggiornato
     */
    setVoxelMaterial(x, y, z, material) {
      const v = this.getVoxelAt(x, y, z);
      if (!v) return false;
      v.material = material;
      this._onVoxelChanged();
      return true;
    }

    /**
     * Cambia modulo di appartenenza a un voxel esistente.
     * @returns {boolean} true se voxel esisteva e modulo aggiornato
     */
    setVoxelModule(x, y, z, module) {
        const v = this.getVoxelAt(x, y, z);
        if (!v) return false;
        v.module = module;
        this._onVoxelChanged();
        return true;
    }

    // ── Primitive Creation Methods ─────────────────────────────────────
    /**
     * Create a cylinder primitive
     * @param {Object} position - {x, y, z} position in voxel coordinates
     * @param {number} radius - radius in mm
     * @param {number} height - height in mm
     * @param {string} material - material name
     * @param {number|null} moduleId - module ID
     * @returns {Array} Array of created voxel positions
     */
    addCylinder(position, radius, height, materialName = 'steel', moduleId = null) {
        if (moduleId === undefined) moduleId = null;
        
        // Convert radius and height to voxel units (1 voxel = 1mm)
        const voxelRadius = Math.max(1, Math.round(radius));
        const voxelHeight = Math.max(1, Math.round(height));
        
        const voxels = [];
        const centerX = position.x;
        const centerY = position.y;
        const centerZ = position.z;
        
        // Generate voxels for cylinder using midpoint circle algorithm for each layer
        for (let y = 0; y < voxelHeight; y++) {
            const yOffset = y - Math.floor(voxelHeight / 2);
            
            // For each layer, fill a circle
            for (let dx = -voxelRadius; dx <= voxelRadius; dx++) {
                for (let dz = -voxelRadius; dz <= voxelRadius; dz++) {
                    const distanceFromCenter = Math.sqrt(dx * dx + dz * dz);
                    if (distanceFromCenter <= voxelRadius) {
                        const voxelPos = {
                            x: centerX + dx,
                            y: centerY + yOffset,
                            z: centerZ + dz
                        };
                        
                        // Check if voxel already exists
                        const existingVoxel = this.getVoxelAt(voxelPos.x, voxelPos.y, voxelPos.z);
                        if (!existingVoxel) {
                            const voxelData = this._addVoxelInternal(voxelPos, materialName, moduleId);
                            if (voxelData) {
                                voxels.push(voxelPos);
                            }
                        }
                    }
                }
            }
        }
        
        this._notify(`Cilindro creato: ${voxels.length} voxel`, 'success');
        return voxels;
    }

    /**
     * Create a cone primitive
     * @param {Object} position - {x, y, z} position in voxel coordinates
     * @param {number} radius - base radius in mm
     * @param {number} height - height in mm
     * @param {string} material - material name
     * @param {number|null} moduleId - module ID
     * @returns {Array} Array of created voxel positions
     */
    addCone(position, radius, height, materialName = 'steel', moduleId = null) {
        if (moduleId === undefined) moduleId = null;
        
        // Convert radius and height to voxel units (1 voxel = 1mm)
        const voxelRadius = Math.max(1, Math.round(radius));
        const voxelHeight = Math.max(1, Math.round(height));
        
        const voxels = [];
        const centerX = position.x;
        const centerY = position.y;
        const centerZ = position.z;
        
        // Generate voxels for cone
        for (let y = 0; y < voxelHeight; y++) {
            // Calculate radius at this height (linear taper from base to tip)
            const yProgress = y / (voxelHeight - 1); // 0 at base, 1 at top
            const currentRadius = voxelRadius * (1 - yProgress); // Decreases from base radius to 0
            
            const yOffset = y - Math.floor(voxelHeight / 2);
            
            // For each layer, fill a circle with current radius
            for (let dx = -Math.ceil(currentRadius); dx <= Math.ceil(currentRadius); dx++) {
                for (let dz = -Math.ceil(currentRadius); dz <= Math.ceil(currentRadius); dz++) {
                    const distanceFromCenter = Math.sqrt(dx * dx + dz * dz);
                    if (distanceFromCenter <= currentRadius) {
                        const voxelPos = {
                            x: centerX + dx,
                            y: centerY + yOffset,
                            z: centerZ + dz
                        };
                        
                        // Check if voxel already exists
                        const existingVoxel = this.getVoxelAt(voxelPos.x, voxelPos.y, voxelPos.z);
                        if (!existingVoxel) {
                            const voxelData = this._addVoxelInternal(voxelPos, materialName, moduleId);
                            if (voxelData) {
                                voxels.push(voxelPos);
                            }
                        }
                    }
                }
            }
        }
        
        this._notify(`Cono creato: ${voxels.length} voxel`, 'success');
        return voxels;
    }

    /**
     * Create a sphere primitive
     * @param {Object} position - {x, y, z} position in voxel coordinates
     * @param {number} diameter - diameter in mm
     * @param {string} material - material name
     * @param {number|null} moduleId - module ID
     * @returns {Array} Array of created voxel positions
     */
    addSphere(position, diameter, materialName = 'steel', moduleId = null) {
        if (moduleId === undefined) moduleId = null;
        
        // Convert diameter to voxel units (1 voxel = 1mm)
        const voxelDiameter = Math.max(1, Math.round(diameter));
        const voxelRadius = Math.floor(voxelDiameter / 2);
        
        const voxels = [];
        const centerX = position.x;
        const centerY = position.y;
        const centerZ = position.z;
        
        // Generate voxels for sphere using 3D distance check
        for (let dx = -voxelRadius; dx <= voxelRadius; dx++) {
            for (let dy = -voxelRadius; dy <= voxelRadius; dy++) {
                for (let dz = -voxelRadius; dz <= voxelRadius; dz++) {
                    const distanceFromCenter = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (distanceFromCenter <= voxelRadius) {
                        const voxelPos = {
                            x: centerX + dx,
                            y: centerY + dy,
                            z: centerZ + dz
                        };
                        
                        // Check if voxel already exists
                        const existingVoxel = this.getVoxelAt(voxelPos.x, voxelPos.y, voxelPos.z);
                        if (!existingVoxel) {
                            const voxelData = this._addVoxelInternal(voxelPos, materialName, moduleId);
                            if (voxelData) {
                                voxels.push(voxelPos);
                            }
                        }
                    }
                }
            }
        }
        
        this._notify(`Sfera creata: ${voxels.length} voxel`, 'success');
        return voxels;
    }

    // ── Optimize: clean up stale references ───────────────────────
    /**
     * Rimuove riferimenti stale da keyToInstance
     */
        optimize() {
            // Clean keyToInstance from stale references
            for (const [mat, instMap] of this.keyToInstance) {
              for (const key of Array.from(instMap.keys())) {
                const [x, y, z] = key.split(',').map(Number);
                const voxel = this.getVoxelAt(x, y, z);
                if (!voxel) {
                  instMap.delete(key);
                }
              }
            }
            this._onVoxelChanged();
          }
      }
