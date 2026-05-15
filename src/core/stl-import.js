/**
 * STL Importer — Carica file STL/OBJ scansionati e verifica adattamento
 */

import * as THREE from 'three';

export class STLImporter {
  constructor(scene, camera, renderer) {
    this.scene = scene;
    this.camera = camera;
    this.renderer = renderer;
  }

  async importSTL(file) {
    const text = await file.text();
    return this.parseASCII_STL(text);
  }

  parseASCII_STL(text) {
    // Parser STL ASCII semplice
    const vertices = [];
    const normals = [];

    const lines = text.split('\n');
    let currentNormal = null;
    let currentVerts = [];

    for (const line of lines) {
      const clean = line.trim().replace(/\s+/g, ' ');
      
      if (!currentNormal && clean.startsWith('facet normal')) {
        const parts = clean.split(' ');
        currentNormal = new THREE.Vector3(
          parseFloat(parts[2]),
          parseFloat(parts[3]),
          parseFloat(parts[4])
        );
        currentVerts = [];
      } else if (currentNormal && clean.startsWith('vertex')) {
        const parts = clean.split(' ');
        currentVerts.push(new THREE.Vector3(
          parseFloat(parts[1]),
          parseFloat(parts[2]),
          parseFloat(parts[3])
        ));
      } else if (clean === 'endfacet' && currentVerts.length === 3) {
        vertices.push(...currentVerts);
        normals.push(currentNormal, currentNormal, currentNormal);
        currentNormal = null;
        currentVerts = [];
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

  async importFile(file) {
    const ext = file.name.split('.').pop().toLowerCase();
    
    if (ext === 'stl') {
      return this.importSTL(file);
    } else if (ext === 'obj') {
      return this.importOBJ(file);
    } else {
      throw new Error('Formato non supportato: ' + ext);
    }
  }

  async importOBJ(file) {
    // Per OBJ usiamo un loader esterno
    // Per ora semplice implementazione solo per STL
    const text = await file.text();
    return this.parseASCII_STL(text); // fallback temporaneo
  }

  fitToScene(geometry, targetSize = 500) {
    // Ridimensiona geometry per adattarsi a targetSize (mm)
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox;
    const size = new THREE.Vector3();
    bbox.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const scaleFactor = targetSize / maxDim;
    
    const scaled = geometry.clone();
    scaled.scale(scaleFactor, scaleFactor, scaleFactor);
    
    // Centra
    scaled.center();
    scaled.translate(0, 0, 0);
    
    return {
      geometry: scaled,
      scaleFactor,
      originalSize: size.clone(),
      bbox: bbox.clone()
    };
  }
}

export class QualityAnalyzer {
  analyzeGeometry(geometry, expectedDiameterMm = 600) {
    const positions = geometry.getAttribute('position');
    const vertexCount = positions.count;
    
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
      deformationScore: Math.min(100, ovality * 5 + maxDeviation * 3)
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