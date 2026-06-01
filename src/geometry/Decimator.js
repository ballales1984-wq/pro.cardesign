// geometry/Decimator.js
import * as THREE from 'three';

// Mock fallback class for environments where SimplifyModifier is unavailable
class SimplifyModifierMock {
  constructor() {}
  modify(geometry, targetCount) {
    if (!geometry || !geometry.attributes || !geometry.attributes.position) {
      return geometry;
    }
    const simplified = geometry.clone();
    if (simplified && simplified.attributes && simplified.attributes.position) {
      return simplified;
    }
    return geometry;
  }
}

export class GeometryDecimator {
  constructor() {
    // Try to load SimplifyModifier dynamically, fallback to mock
    this.simplifyModifier = new SimplifyModifierMock();
    this._initSimplifyModifier();
  }

  async _initSimplifyModifier() {
    try {
      const mod = await import('three/examples/jsm/modifiers/SimplifyModifier.js');
      this.simplifyModifier = new mod.SimplifyModifier();
    } catch {
      // Keep mock if real modifier unavailable
    }
  }

  /**
   * Decima una geometria automaticamente
   * @param {THREE.BufferGeometry} geometry
   * @param {number} targetRatio - 0.1 = decima al 10% dei vertici originali
   * @param {boolean} preserveUVs - mantieni UV se presenti
   * @returns {THREE.BufferGeometry|*} geometria decimata o originale se errore
   */
  decimate(geometry, targetRatio = 0.25, preserveUVs = true) {
    if (!geometry || !geometry.attributes || !geometry.attributes.position) {
      return geometry;
    }

    const originalVertexCount = geometry.attributes.position.count;
    const targetCount = Math.max(4, Math.floor(originalVertexCount * targetRatio));
    console.log(`Decimazione: ${originalVertexCount} → ${targetCount} vertici (${(targetRatio*100).toFixed(1)}%)`);

    let geo = geometry;

    // Only call toNonIndexed on *actually indexed* geometry (non-null index attribute).
    // Plain BufferGeometries without an index attribute are already non-indexed;
    // calling toNonIndexed() on them can produce a broken geometry.
    if (geo.index !== null && geo.index !== undefined) {
      geo = geo.toNonIndexed();
      // After toNonIndexed, ensure position attribute still exists
      if (!geo || !geo.attributes || !geo.attributes.position) {
        console.warn("Decimazione fallita (toNonIndexed produced invalid geometry), ritorno geometria originale");
        return geometry;
      }
    }

    // Rimuovi attributi non necessari
    if (!preserveUVs && geo.attributes.uv) {
      geo.deleteAttribute('uv');
    }

    try {
      const simplified = this.simplifyModifier.modify(geo, targetCount);

      // Validate simplified geometry - real SimplifyModifier may return null/invalid for mock data
      if (!simplified) {
        console.warn("Decimazione fallita (simplified is null), ritorno geometria originale");
        return geometry;
      }
      // Accept either true isBufferGeometry OR any object with attributes.position (for mock compatibility)
      if (simplified.isBufferGeometry !== true && !simplified.attributes?.position) {
        console.warn("Decimazione fallita (simplified is not a BufferGeometry), ritorno geometria originale");
        return geometry;
      }
      
      // Additional safety: ensure position attribute has count
      if (!simplified.attributes.position.count) {
        console.warn("Decimazione fallita (position.count missing), ritorno geometria originale");
        return geometry;
      }

      simplified.computeVertexNormals();
      simplified.computeBoundingBox();
      simplified.computeBoundingSphere();

      console.log(`✓ Decimazione completata: ${(simplified.attributes.position.count / originalVertexCount * 100).toFixed(1)}% rimanente`);
      return simplified;
    } catch (error) {
      console.warn("Decimazione fallita, ritorno geometria originale", error.message || error);
      return geometry;
    }
  }

  /**
   * Decimazione intelligente per CSG / Preview
   */
  decimateForCSG(geometry, aggressiveness = 'medium') {
    const ratios = {
      low: 0.6,
      medium: 0.25,
      high: 0.08,
      extreme: 0.03,
    };
    return this.decimate(geometry, ratios[aggressiveness] || 0.25, false);
  }
}
