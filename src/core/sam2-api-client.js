/**
 * sam2-api-client — Client per API backend SAM2
 * Chiama l'endpoint FastAPI /api/v1/segment per segmentazione auto.
 * Fallback a ObjectSegmentation locale se il backend non è raggiungibile.
 */
const SAM2_BACKEND = 'http://localhost:8000';

export class SAM2ApiClient {
  constructor() {
    this.available = false;
    this.modelUsed = 'none';
  }

  async check() {
    try {
      const res = await fetch(`${SAM2_BACKEND}/health`, {
        method: 'GET',
        signal: AbortSignal.timeout(2000)
      });
      if (res.ok) {
        this.available = true;
        const data = await res.json();
        console.log('[SAM2ApiClient] Backend reachable:', data);
        return true;
      }
    } catch (err) {
      console.warn('[SAM2ApiClient] Backend unreachable, using local fallback:', err.message);
    }
    this.available = false;
    return false;
  }

  async segmentImage(imageBitmapOrCanvas) {
    if (!this.available) {
      await this.check();
    }

    if (!this.available) {
      return { local: true, modelUsed: 'local-fallback', mask: null };
    }

    try {
      const blob = await this._toBlob(imageBitmapOrCanvas);
      const form = new FormData();
      form.append('file', blob, 'image.jpg');

      const res = await fetch(`${SAM2_BACKEND}/api/v1/segment`, {
        method: 'POST',
        body: form,
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`);
      }

      const data = await res.json();
      this.modelUsed = data.model_used;
      return {
        local: false,
        modelUsed: data.model_used,
        maskShape: data.mask_shape,
        bboxCount: data.bbox_count,
        carBbox: data.car_bbox,
        processingMs: data.processing_ms
      };

    } catch (err) {
      console.warn('[SAM2ApiClient] Segment request failed, falling back to local:', err);
      this.available = false;
      return { local: true, modelUsed: 'local-fallback', mask: null };
    }
  }

  async _toBlob(source) {
    if (source instanceof Blob) return source;
    if (source instanceof ImageBitmap) {
      const canvas = new OffscreenCanvas(source.width, source.height);
      const ctx = canvas.getContext('2d');
      ctx.drawImage(source, 0, 0);
      return canvas.convertToBlob({ type: 'image/jpeg', quality: 0.9 });
    }
    if (source instanceof HTMLCanvasElement) {
      return new Promise(resolve => source.toBlob(resolve, 'image/jpeg', 0.9));
    }
    if (source instanceof HTMLImageElement) {
      const canvas = document.createElement('canvas');
      canvas.width = source.naturalWidth || source.width;
      canvas.height = source.naturalHeight || source.height;
      canvas.getContext('2d').drawImage(source, 0, 0);
      return new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.9));
    }
    throw new Error('Unsupported image source for blob conversion');
  }
}

export const sam2ApiClient = new SAM2ApiClient();
