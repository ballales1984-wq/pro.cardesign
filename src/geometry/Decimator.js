// geometry/Decimator.js
import { SimplifyModifier } from 'three/examples/jsm/modifiers/SimplifyModifier.js';
import * as THREE from 'three';

export class GeometryDecimator {
  constructor() {
    this.simplifyModifier = new SimplifyModifier();
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
    }

    // Rimuovi attributi non necessari
    if (!preserveUVs && geo.attributes.uv) {
      geo.deleteAttribute('uv');
    }

    try {
      const simplified = this.simplifyModifier.modify(geo, targetCount);

      if (!simplified || !simplified.attributes || !simplified.attributes.position) {
        console.warn("Decimazione fallita (simplified geometry invalid), ritorno geometria originale");
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
