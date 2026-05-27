/**
 * BrickSystem - Manages bricks with real dimensions in millimeters
 * 1 Three.js unit = 1mm
 */

// Import static: permette al test runner di iniettare un mock prima del caricamento
import * as THREE from 'three';


export class Brick {
    constructor(id, name = "Brick", position, size, material = 'steel', module = null) {
        this.id = id;
        this.name = name;
        this.position = position; // {x, y, z} in mm
        this.size = size;         // {x, y, z} in mm
        this.material = material;
        this.module = module;
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

    get max_corner() {
        return {
            x: this.position.x + this.size.x,
            y: this.position.y + this.size.y,
            z: this.position.z + this.size.z
        };
    }

    contains_point(point) {
        return (
            point.x >= this.position.x && point.x <= this.max_corner.x &&
            point.y >= this.position.y && point.y <= this.max_corner.y &&
            point.z >= this.position.z && point.z <= this.max_corner.z
        );
    }

    overlaps(other) {
        return ! (
            this.max_corner.x <= other.position.x ||
            this.max_corner.y <= other.position.y ||
            this.max_corner.z <= other.position.z ||
            other.max_corner.x <= this.position.x ||
            other.max_corner.y <= this.position.y ||
            other.max_corner.z <= this.position.z
        );
    }
}

export class BrickSystem {
    constructor(voxelEngine) {
        this.voxelEngine = voxelEngine;
        this.bricks = new Map();
        this.nextId = 1;
        this.SCALE = 1.0; // 1 Three.js unit = 1mm
        this.selectedBrick = null;

        // Interaction state
        this.resizeAxis = null;
        this.startSize = 0;
        this.startMouse = 0;
        this.isDragging = false;

        // Brick mesh group — must be in scene so bricks are visible
        this.brickGroup = new THREE.Group();
        this.voxelEngine.scene.add(this.brickGroup);

        // Instanced rendering for performance
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
            voxel.material,
            voxel.module
        );
        this.bricks.set(brick.id, brick);
        this.updateBrickVisual(brick);
        return brick;
    }

    createCylinder(id, name, radius, height, position = {x: 0, y: 0, z: 0}, material = 'steel', module = null) {
        // Cylinder occupies a box of [2*radius, height, 2*radius]
        const brick = new Brick(
            id,
            name,
            position,
            { x: 2 * radius, y: height, z: 2 * radius },
            material,
            module
        );
        this.bricks.set(brick.id, brick);
        this.updateBrickVisual(brick);
        return brick;
    }

    createCone(id, name, radius, height, position = {x: 0, y: 0, z: 0}, material = 'steel', module = null) {
        // Cone occupies same bounding box as cylinder: [2*radius, height, 2*radius]
        const brick = new Brick(
            id,
            name,
            position,
            { x: 2 * radius, y: height, z: 2 * radius },
            material,
            module
        );
        this.bricks.set(brick.id, brick);
        this.updateBrickVisual(brick);
        return brick;
    }

    createSphere(id, name, diameter, position = {x: 0, y: 0, z: 0}, material = 'steel', module = null) {
        // Sphere occupies a cube: [diameter, diameter, diameter]
        const brick = new Brick(
            id,
            name,
            position,
            { x: diameter, y: diameter, z: diameter },
            material,
            module
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
                color: 0xe94560
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
        if (this.selectedBrick && this.isDragging) {
            this.syncBrickToVoxelEngine(this.selectedBrick);
        }
        this.isDragging = false;
        this.resizeAxis = null;
    }

     /**
      * Sync brick size back to voxel engine scale data
      * @param {Brick} brick - The brick to sync
      */
syncBrickToVoxelEngine(brick) {
        // Find corresponding voxel at brick's position
        const voxelPos = {
            x: Math.round(brick.position.x),
            y: Math.round(brick.position.y),
            z: Math.round(brick.position.z)
        };
        const voxel = this.voxelEngine.getVoxelAt(voxelPos.x, voxelPos.y, voxelPos.z);
        if (voxel) {
            // Update voxel scale
            voxel.scale = [brick.size.x, brick.size.y, brick.size.z];
        }
    }

    get dimensionsText() {
        if (this.selectedBrick) {
            const b = this.selectedBrick;
            return `${b.size.x.toFixed(0)} × ${b.size.y.toFixed(0)} × ${b.size.z.toFixed(0)} mm`;
        }
        return '';
    }

_setupInteraction() {
        // Skip interaction setup - not needed for basic functionality
    }

     _convertExistingVoxels() {
         // Simple conversion: each brick becomes a Brick object
         for (const voxel of this.voxelEngine.voxelsIterator()) {
             this.createBrickFromVoxel(voxel);
         }
     }
}

export default BrickSystem;