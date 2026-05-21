// geometry/AutoDecimator.js
import { GeometryDecimator } from './Decimator.js';

const decimator = new GeometryDecimator();

export class AutoDecimator {
  static optimizeForUseCase(geometry, useCase) {
    switch (useCase) {
      case 'preview':
        return decimator.decimate(geometry, 0.15, false);   // molto leggera

      case 'boolean-tool':
        return decimator.decimate(geometry, 0.20, false);

      case 'final-export':
        return decimator.decimate(geometry, 0.45, true);    // conserva più dettaglio

      case 'viewport':
        return decimator.decimate(geometry, 0.35, true);

      default:
        return geometry;
    }
  }
}