import { MeshoptDecimator } from './MeshoptDecimator.js';

export class MeshoptWorkerManager {
  constructor() {
    this.worker = null;
    this.pending = new Map();
    this.id = 0;
  }

  _getWorker() {
    if (!this.worker) {
      this.worker = new Worker(new URL('./MeshoptWorker.js', import.meta.url), { type: 'module' });
      this.worker.onmessage = (e) => {
        const { id, success, vertices, indices, vertexCount, error } = e.data;
        const pending = this.pending.get(id);
        if (pending) {
          this.pending.delete(id);
          if (success) {
            import('three').then(({ BufferGeometry, BufferAttribute }) => {
              const geometry = new BufferGeometry();
              geometry.setAttribute('position', new BufferAttribute(new Float32Array(vertices), 3));
              geometry.setIndex(Array.from(indices));
              geometry.computeVertexNormals();
              pending.resolve(geometry);
            });
          } else {
            pending.reject(new Error(error));
          }
        }
      };
    }
    return this.worker;
  }

  decimateAsync(geometry, targetRatio = 0.25, options = {}) {
    return new Promise((resolve, reject) => {
      const worker = this._getWorker();
      
      const id = ++this.id;
      this.pending.set(id, { resolve, reject });
      
      const positions = geometry.attributes.position.array;
      const indices = geometry.index ? geometry.index.array : null;
      
      worker.postMessage({
        id,
        geometryData: {
          positions: Array.from(positions),
          indices: indices ? Array.from(indices) : null
        },
        targetRatio,
        options
      });
    });
  }

  terminate() {
    if (this.worker) {
      this.worker.terminate();
      this.worker = null;
      this.pending.clear();
    }
  }
}