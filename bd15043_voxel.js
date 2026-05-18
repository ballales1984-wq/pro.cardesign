/**
 * VoxelEngine - Manages the 3D grid, rendering and voxel interaction
 *
 * Uses InstancedMesh for material ÔÇö a single draw call per material
 * instead of one per voxel. Improvement: ~10-50x with large scenes.
 */
// Import dinamico: permette al test runner di iniettare un mock prima del caricamento
const THREE = await import('three');
;
import { Chunk } from './core/chunk-system.js';
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
   
       // ÔöÇÔöÇ Chunk management ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
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
   
     // ÔöÇÔöÇ InstancedMesh management ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
   
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
               const matrix = new THREE.Matrix4();
               matrix.makeScale(scale.x, scale.y, scale.z);
               // Apply translation after scale
               matrix.elements[12] = position.x;
               matrix.elements[13] = position.y;
               matrix.elements[14] = position.z;
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
   
       // ÔöÇÔöÇ Rendering ÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇÔöÇ
   
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
             
             // Update scale inputs when voxel is selected
             window.addEventListener('voxel-selected', function(e) {
