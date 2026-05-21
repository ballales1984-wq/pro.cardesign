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
   * @param {number} targetRatio - 0.1 = riduci al 10% dei vertici originali
   * @param {boolean} preserveUVs - mantieni UV se presenti
   */
  decimate(geometry, targetRatio = 0.25, preserveUVs = true) {
    if (!geometry || !geometry.attributes.position) return geometry;

    const originalVertexCount = geometry.attributes.position.count;
    const targetCount = Math.floor(originalVertexCount * targetRatio);

    console.log(`Decimazione: ${originalVertexCount} → ${targetCount} vertici (${(targetRatio*100).toFixed(1)}%)`);

    let geo = geometry.clone();

    // Preparazione ottimale
    geo = this._prepareGeometry(geo, preserveUVs);

    try {
      const simplified = this.simplifyModifier.modify(geo, targetCount);

      // Pulizia post-decimazione
      simplified.computeVertexNormals();
      simplified.computeBoundingBox();
      simplified.computeBoundingSphere();

      console.log(`✓ Decimazione completata: ${(simplified.attributes.position.count / originalVertexCount * 100).toFixed(1)}% rimanente`);
      return simplified;
    } catch (error) {
      console.warn("Decimazione fallita, ritorno geometria originale", error);
      return geometry;
    }
  }

  _prepareGeometry(geometry, preserveUVs) {
    // Merge vertici molto vicini
    if (geometry.index) {
      // Opzionale: converti in non-indexed per migliore decimazione
      geometry = geometry.toNonIndexed();
    }

    // Rimuovi attributi non necessari per velocizzare
    if (!preserveUVs && geometry.attributes.uv) {
      geometry.deleteAttribute('uv');
    }

    return geometry;
  }

  /**
   * Decimazione intelligente per CSG / Preview
   */
  decimateForCSG(geometry, aggressiveness = 'medium') {
    const ratios = {
      low: 0.6,      // leggera
      medium: 0.25,  // buona
      high: 0.08,    // aggressiva
      extreme: 0.03
    };
    return this.decimate(geometry, ratios[aggressiveness] || 0.25, false);
  }
}