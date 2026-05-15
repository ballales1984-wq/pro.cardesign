/**
 * BrickSystem - Gestisce brick con dimensioni reali in millimetri
 * 1 unità Three.js = 1mm
 */

import * as THREE from 'three';

export class Brick {
    constructor(id, name, position, size, material = 'steel') {
        this.id = id;
        this.name = name;
        this.position = position; // {x, y, z} in mm
        this.size = size;         // {x, y, z} in mm
        this.material = material;
        this.isVisible = true;
        this.isSelected = false;
        this.mesh = null;
        this.wireframe = null;
    }

    get center() {
        return {
            x: this.position.x + this.size.x / 2,
            y: this.position.y + this.size.y / 2,
            z: this.position.z + this.size.z / 2
        };
    }

    get volume_mm3() {
        return this.size.x * this.size.y * this.size.z;
    }
}

export class BrickSystem {
    constructor(voxelEngine) {
        this.voxelEngine = voxelEngine;
        this.bricks = new Map();
        this.nextId = 1;
        this.SCALE = 0.01; // 1mm = 0.01 Three.js units
        this.selectedBrick = null;
        
        // Interaction state
        this.resizeAxis = null;
        this.startSize = 0;
        this.startMouse = 0;
        this.isDragging = false;

        // Brick mesh group
        this.brickGroup = new THREE.Group();
        voxelEngine.scene.add(this.brickGroup);

        // Instanced rendering per performance
        this.instancedMeshes = new Map();
        
        this._setupInteraction();
        this._convertExistingVoxels();
    }

    createBrickFromVoxel(voxel) {
        const brick = new Brick(
            this.nextId++,
            `Voxel_${voxel.x}_${voxel.y}_${voxel.z}`,
            { x: voxel.x, y: voxel.y, z: voxel.z },
            { x: 1, y: 1, z: 1 },
            voxel.material
        );
        this.bricks.set(brick.id, brick);
        this.updateBrickVisual(brick);
        return brick;
    }

    updateBrickVisual(brick) {
        if (brick.mesh) {
            this.brickGroup.remove(brick.mesh);
        }
        if (brick.wireframe) {
            this.brickGroup.remove(brick.wireframe);
        }
        
        const geometry = new THREE.BoxGeometry(
            brick.size.x * this.SCALE,
            brick.size.y * this.SCALE,
            brick.size.z * this.SCALE
        );

        const material = new THREE.MeshStandardMaterial({
            color: this._getMaterialColor(brick.material),
            roughness: 0.4,
            metalness: 0.3,
            transparent: brick.isSelected,
            opacity: brick.isSelected ? 0.8 : 1.0
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(
            brick.center.x * this.SCALE,
            brick.center.y * this.SCALE,
            brick.center.z * this.SCALE
        );
        mesh.userData.brick = brick;
        
        this.brickGroup.add(mesh);
        brick.mesh = mesh;
        
        // Add wireframe for selection
        if (brick.isSelected) {
            const edges = new THREE.EdgesGeometry(geometry);
            const lineMat = new THREE.LineBasicMaterial({ 
                color: 0xe94560, 
                linewidth: 2 
            });
            const wireframe = new THREE.LineSegments(edges, lineMat);
            wireframe.position.copy(mesh.position);
            this.brickGroup.add(wireframe);
            brick.wireframe = wireframe;
        }
    }

    _getMaterialColor(materialName) {
        const colors = {
            steel: 0x888888,
            aluminum: 0xc0c0c0,
            titanium: 0x87ceeb,
            carbon_fiber: 0x1a1a1a,
            rubber: 0x2a2a2a
        };
        return colors[materialName] || 0xcccccc;
    }

    selectBrick(brick) {
        if (this.selectedBrick) {
            this.selectedBrick.isSelected = false;
            this.updateBrickVisual(this.selectedBrick);
        }
        this.selectedBrick = brick;
        brick.isSelected = true;
        this.updateBrickVisual(brick);
        
        window.dispatchEvent(new CustomEvent('brick-selected', { detail: brick }));
    }

    startResize(brick, axis, mouseX) {
        this.resizeAxis = axis;
        this.startSize = brick.size[axis];
        this.startMouse = mouseX;
        this.isDragging = true;
        this.selectBrick(brick);
    }

    updateResize(mouseX, scaleFactor = 10.0) {
        if (!this.resizeAxis || !this.selectedBrick || !this.isDragging) return null;
        
        const delta = (mouseX - this.startMouse) * scaleFactor;
        const newSize = Math.max(1, this.startSize + delta);
        this.selectedBrick.size[this.resizeAxis] = newSize;
        this.updateBrickVisual(this.selectedBrick);
        
        return newSize;
    }

    stopResize() {
        this.isDragging = false;
        this.resizeAxis = null;
    }

    get dimensionsText() {
        if (this.selectedBrick) {
            const b = this.selectedBrick;
            return `${b.size.x.toFixed(0)} × ${b.size.y.toFixed(0)} × ${b.size.z.toFixed(0)} mm`;
        }
        return '';
    }

    _setupInteraction() {
        const canvas = this.voxelEngine.renderer.domElement;
        
        canvas.addEventListener('pointerdown', (e) => {
            if (e.button !== 0 || !e.shiftKey) return;
            const brick = this._getBrickAtScreen(e.clientX, e.clientY);
            if (brick) {
                this.isDragging = true;
                const axis = this._getAxisFromMouse(e);
                this.startResize(brick, axis, e.clientX);
            }
        });
        
        canvas.addEventListener('pointermove', (e) => {
            if (!this.isDragging) return;
            const newSize = this.updateResize(e.clientX);
            if (newSize) {
                const label = document.getElementById('dimension-label');
                if (label) {
                    label.textContent = this.dimensionsText;
                    label.style.display = 'block';
                }
            }
        });
        
        canvas.addEventListener('pointerup', () => {
            this.isDragging = false;
            const label = document.getElementById('dimension-label');
            if (label) label.style.display = 'none';
            this.stopResize();
        });
        
        canvas.addEventListener('pointerleave', () => {
            this.isDragging = false;
            const label = document.getElementById('dimension-label');
            if (label) label.style.display = 'none';
            this.stopResize();
        });
    }

    _getBrickAtScreen(x, y) {
        // Raycast to find brick
        const rect = this.voxelEngine.renderer.domElement.getBoundingClientRect();
        this.voxelEngine.pointer.x = ((x - rect.left) / rect.width) * 2 - 1;
        this.voxelEngine.pointer.y = -((y - rect.top) / rect.height) * 2 + 1;
        
        this.voxelEngine.raycaster.setFromCamera(this.voxelEngine.pointer, this.voxelEngine.camera);
        const intersects = this.voxelEngine.raycaster.intersectObjects(this.brickGroup.children);
        
        if (intersects.length > 0) {
            return intersects[0].object.userData.brick;
        }
        return null;
    }

    _getAxisFromMouse(e) {
        // Simple implementation: default to X axis
        // Could be improved to detect which face was clicked
        return 'x';
    }

    _convertExistingVoxels() {
        // Convert existing voxels to bricks
        const voxelMap = this.voxelEngine.voxels;
        const processedPositions = new Set();
        
        for (const [key, voxel] of voxelMap.entries()) {
            if (processedPositions.has(key)) continue;
            
            // Find connected voxels of same material to merge into bricks
            const connected = this._findConnectedVoxels(voxel, voxelMap);
            
            if (connected.size === 1) {
                // Single voxel -> 1x1x1 brick
                const v = connected.values().next().value;
                this.createBrickFromVoxel(v);
                processedPositions.add(key);
            } else {
                 // Group connected voxels into a brick
                const positions = Array.from(connected.values());
                const minX = Math.min(...positions.map(v => v.x));
                const minY = Math.min(...positions.map(v => v.y));
                const minZ = Math.min(...positions.map(v => v.z));
                const maxX = Math.max(...positions.map(v => v.x));
                const maxY = Math.max(...positions.map(v => v.y));
                const maxZ = Math.max(...positions.map(v => v.z));
                
                const width = (maxX - minX + 1) * 1; // 1 unit per voxel
                const height = (maxY - minY + 1) * 1;
                const depth = (maxZ - minZ + 1) * 1;
                
                const firstVoxel = positions[0];
                this.createBrickFromVoxel({
                    x: minX,
                    y: minY,
                    z: minZ
                });
                // Actually create with proper size
                const brick = new Brick(
                    this.nextId++,
                    `Merged_${minX}_${minY}_${minZ}`,
                    { x: minX, y: minY, z: minZ },
                    { x: width, y: height, z: depth },
                    firstVoxel.material
                );
                this.bricks.set(brick.id, brick);
                this.updateBrickVisual(brick);
                
                // Mark all positions as processed
                for (const v of positions) {
                    const vKey = `${v.x},${v.y},${v.z}`;
                    processedPositions.add(vKey);
                }
            }
        }
    }

    _findConnectedVoxels(startVoxel, voxelMap) {
        const visited = new Set();
        const queue = [startVoxel];
        const startKey = `${startVoxel.x},${startVoxel.y},${startVoxel.z}`;
        visited.add(startKey);
        
        while (queue.length > 0) {
            const current = queue.shift();
            const currentKey = `${current.x},${current.y},${current.z}`;
            
            // Check 6 neighbors
            const neighbors = [
                { x: current.x + 1, y: current.y, z: current.z },
                { x: current.x - 1, y: current.y, z: current.z },
                { x: current.x, y: current.y + 1, z: current.z },
                { x: current.x, y: current.y - 1, z: current.z },
                { x: current.x, y: current.y, z: current.z + 1 },
                { x: current.x, y: current.y, z: current.z - 1 }
            ];
            
            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y},${neighbor.z}`;
                if (!visited.has(neighborKey)) {
                    const neighborVoxel = voxelMap.get(neighborKey);
                    if (neighborVoxel && neighborVoxel.material === current.material) {
                        visited.add(neighborKey);
                        queue.push(neighborVoxel);
                    }
                }
            }
        }
        
        // Return the voxels
        const result = new Map();
        for (const key of visited) {
            const [x, y, z] = key.split(',').map(Number);
            const voxel = voxelMap.get(key);
            if (voxel) {
                result.set(key, voxel);
            }
        }
        return result;
    }
}

export default BrickSystem;