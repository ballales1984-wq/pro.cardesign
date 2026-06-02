import { DepthEstimation, ObjectSegmentation, DepthFilter, TSDFVolume } from './depth-estimation.js';
import { sam2ApiClient } from './sam2-api-client.js';

export class DepthPipeline {
  constructor(voxelEngine) {
    this.voxelEngine = voxelEngine;
    this.depthEstimator = new DepthEstimation(voxelEngine);
    this.segmentation = new ObjectSegmentation();
    this.depthFilter = new DepthFilter();
    this.sam2BackendAvailable = false;
  }

  async processImage(file, options = {}) {
    const defaults = this._defaultsForDomain(options.domain);
    const opts = { ...defaults, ...options };
    const image = await this._loadImage(file);
    const { depthMap, meta } = await this.depthEstimator.estimateDepthFromImage(file, opts.depthTargetSize);
    const normalizedDepth = this._normalizeDepthMap(depthMap);

    const objects = await this._segmentImage(image);
    const mask = this._createMaskFromObjects(objects, normalizedDepth.width, normalizedDepth.height);

    const filteredDepth = this._filterDepth(normalizedDepth, opts);
    const maskedDepth = this._applyMask(filteredDepth, mask);

    const width = maskedDepth.width;
    const height = maskedDepth.height;

    const camera = {
      fx: opts.fx ?? Math.max(width, 256),
      fy: opts.fy ?? Math.max(height, 256),
      cx: opts.cx ?? width / 2,
      cy: opts.cy ?? height / 2
    };

    const pointCloud = this._depthToPointCloud(maskedDepth, {
      fx: camera.fx,
      fy: camera.fy,
      cx: camera.cx,
      cy: camera.cy,
      scale: opts.pointScale || 1
    });

    const voxels = opts.mode === 'tsdf'
      ? this._buildSurfaceVoxels(maskedDepth, mask, {
          gridResolution: opts.gridResolution || 64,
          voxelSize: opts.voxelSize || 5,
          surfaceThreshold: opts.surfaceThreshold ?? 0.15,
          fx: camera.fx,
          fy: camera.fy,
          cx: camera.cx,
          cy: camera.cy,
          fallbackOnEmpty: opts.fallbackOnEmpty !== false,
          maxDepthVoxels: opts.maxDepthVoxels || 40,
          minThreshold: opts.minThreshold ?? 0.03
        })
      : this._depthMapToVoxels(maskedDepth, mask, {
          gridResolution: opts.gridResolution || 64,
          maxDepthVoxels: opts.maxDepthVoxels || 40,
          minThreshold: opts.minThreshold ?? 0.03,
          voxelSize: opts.voxelSize || 5
        });

    const cleaned = this._cleanVoxels(voxels, opts);
    return { voxels: cleaned, depthMap: maskedDepth, mask, pointCloud, meta };
  }

  _defaultsForDomain(domain) {
    if (domain === 'vehicle' || domain === 'car') {
      return {
        voxelSize: 5,
        gridResolution: 64,
        maxDepthVoxels: 40,
        minThreshold: 0.03,
        surfaceThreshold: 0.12,
        depthTargetSize: 512,
        filterDepth: true,
        smooth: true,
        minNeighbors: 2
      };
    }
    if (domain === 'building') {
      return {
        voxelSize: 10,
        gridResolution: 48,
        maxDepthVoxels: 60,
        minThreshold: 0.02,
        surfaceThreshold: 0.15,
        depthTargetSize: 512,
        filterDepth: true,
        smooth: true,
        minNeighbors: 3
      };
    }
    return {
      voxelSize: 5,
      gridResolution: 48,
      maxDepthVoxels: 30,
      minThreshold: 0.04,
      surfaceThreshold: 0.18,
      depthTargetSize: 256,
      filterDepth: true,
      smooth: true,
      minNeighbors: 2
    };
  }

  async _loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async _segmentImage(image) {
    if (!this.sam2BackendAvailable) {
      this.sam2BackendAvailable = await sam2ApiClient.check();
    }

    if (this.sam2BackendAvailable) {
      try {
        const result = await sam2ApiClient.segmentImage(image);
        if (!result.local && result.carBbox) {
          const bbox = result.carBbox;
          const mask = this._bboxToMask(
            this._normalizeDepthMap({ width: image.width || 256, height: image.height || 256, data: new Float32Array(image.width * image.height || 256 * 256) }), // placeholder shape
            bbox, image.width || 256, image.height || 256
          );
          console.log(`[DepthPipeline] SAM2 segmentation: ${result.modelUsed}, bbox=${bbox.x},${bbox.y} ${bbox.w}x${bbox.h}`);
          return [{ bbox: [bbox.x, bbox.y, bbox.w, bbox.h], confidence: bbox.confidence, modelUsed: result.modelUsed }];
        }
      } catch (err) {
        console.warn('[DepthPipeline] SAM2 backend failed, falling back to local:', err.message);
        this.sam2BackendAvailable = false;
      }
    }

    try {
      return await this.segmentation.segmentImage(image);
    } catch (err) {
      console.warn('DepthPipeline: local segmentation failed, using fallback full image mask', err.message);
      return [{ bbox: [0, 0, image.width || 256, image.height || 256], confidence: 1.0 }];
    }
  }

  _bboxToMask(normalizedDepth, bbox, width, height) {
    const mask = new Uint8Array(width * height);
    if (!bbox) { mask.fill(1); return mask; }
    const [x, y, w, h] = bbox.bbox || bbox;
    const minX = Math.max(0, Math.floor(x));
    const minY = Math.max(0, Math.floor(y));
    const maxX = Math.min(width, Math.ceil(x + w));
    const maxY = Math.min(height, Math.ceil(y + h));
    for (let yy = minY; yy < maxY; yy++) {
      for (let xx = minX; xx < maxX; xx++) {
        mask[yy * width + xx] = 1;
      }
    }
    if (!mask.some(v => v === 1)) mask.fill(1);
    return mask;
  }

  _createMaskFromObjects(objects, width, height) {
    const mask = new Uint8Array(width * height);
    if (!objects || objects.length === 0) {
      mask.fill(1);
      return mask;
    }

    for (const obj of objects) {
      if (!obj.bbox || obj.bbox.length < 4) continue;
      const [x, y, w, h] = obj.bbox;
      const minX = Math.max(0, Math.floor(x));
      const minY = Math.max(0, Math.floor(y));
      const maxX = Math.min(width, Math.ceil(x + w));
      const maxY = Math.min(height, Math.ceil(y + h));
      for (let yy = minY; yy < maxY; yy++) {
        for (let xx = minX; xx < maxX; xx++) {
          mask[yy * width + xx] = 1;
        }
      }
    }

    if (!mask.some(v => v === 1)) {
      mask.fill(1);
    }
    return mask;
  }

  _normalizeDepthMap(depthMap) {
    const data = depthMap.data;
    const minDepth = Math.min(...data);
    const maxDepth = Math.max(...data);
    const range = Math.max(maxDepth - minDepth, 1e-6);
    const normalized = new Float32Array(data.length);
    for (let i = 0; i < data.length; i++) {
      normalized[i] = Math.min(1, Math.max(0, (data[i] - minDepth) / range));
    }
    return { width: depthMap.width, height: depthMap.height, data: normalized };
  }

  _filterDepth(depthMap, options) {
    if (!options.filterDepth) {
      return depthMap;
    }
    return this.depthFilter.filterDepthMap(depthMap, { medianKernel: options.medianKernel || 2 });
  }

  _applyMask(depthMap, mask) {
    if (!mask) {
      return depthMap;
    }
    return this.depthFilter.applyMask(depthMap, mask);
  }

  _depthToPointCloud(depthMap, opts) {
    const pts = [];
    const w = depthMap.width;
    const h = depthMap.height;
    const fx = opts.fx || w;
    const fy = opts.fy || h;
    const cx = opts.cx ?? w / 2;
    const cy = opts.cy ?? h / 2;
    const scale = opts.scale || 1;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const d = depthMap.data[y * w + x];
        if (d <= 0) continue;
        const px = ((x - cx) * d / fx) * scale;
        const py = ((y - cy) * d / fy) * scale;
        const pz = d * scale;
        pts.push({ x: px, y: -py, z: pz });
      }
    }
    return pts;
  }

  _buildSurfaceVoxels(depthMap, mask, opts) {
    const tsdf = new TSDFVolume(opts.gridResolution || 16, opts.voxelSize || 1);
    tsdf.truncationDistance = opts.truncationDistance || Math.max(1, tsdf.resolution * tsdf.voxelSize * 0.08);

    tsdf.integrateDepth(depthMap, opts.fx, opts.fy, opts.cx, opts.cy);
    const voxels = tsdf.extractSurface(opts.surfaceThreshold);

    if (voxels.length === 0 && opts.fallbackOnEmpty) {
      return this._depthMapToVoxels(depthMap, mask, {
        gridResolution: opts.gridResolution || Math.min(depthMap.width, depthMap.height, 16),
        maxDepthVoxels: opts.maxDepthVoxels || 18,
        minThreshold: opts.minThreshold ?? 0.15,
        voxelSize: opts.voxelSize || this.voxelEngine?.voxelSize || 1
      });
    }

    return voxels;
  }

  _depthMapToVoxels(depthMap, mask, opts) {
    const voxels = [];
    const width = depthMap.width;
    const height = depthMap.height;
    const resolution = Math.min(opts.gridResolution || Math.min(width, height), width, height);
    const stepX = Math.max(1, Math.floor(width / resolution));
    const stepY = Math.max(1, Math.floor(height / resolution));
    const halfWidth = width / 2;
    const halfHeight = height / 2;

    for (let iy = 0; iy < height; iy += stepY) {
      for (let ix = 0; ix < width; ix += stepX) {
        const index = iy * width + ix;
        if (mask && mask[index] !== 1) continue;

        const depthValue = depthMap.data[index];
        if (depthValue < opts.minThreshold) continue;

        const heightVoxels = Math.max(1, Math.round(depthValue * opts.maxDepthVoxels));
        const x = Math.round(((ix + stepX * 0.5) - halfWidth) * opts.voxelSize / stepX);
        const z = Math.round(((iy + stepY * 0.5) - halfHeight) * opts.voxelSize / stepY);

        for (let y = 0; y < heightVoxels; y++) {
          voxels.push({ x, y, z, material: 'steel' });
        }
      }
    }
    return voxels;
  }

  _cleanVoxels(voxels, options) {
    if (!options.smooth || voxels.length === 0) return voxels;
    const voxelSet = new Set(voxels.map(v => `${v.x},${v.y},${v.z}`));
    const minNeighbors = options.minNeighbors || 2;
    const cleaned = [];

    for (const voxel of voxels) {
      let neighbors = 0;
      for (const dx of [-1, 0, 1]) {
        for (const dy of [-1, 0, 1]) {
          for (const dz of [-1, 0, 1]) {
            if (dx === 0 && dy === 0 && dz === 0) continue;
            if (voxelSet.has(`${voxel.x + dx},${voxel.y + dy},${voxel.z + dz}`)) neighbors++;
            if (neighbors >= minNeighbors) break;
          }
          if (neighbors >= minNeighbors) break;
        }
        if (neighbors >= minNeighbors) break;
      }
      if (neighbors >= minNeighbors) cleaned.push(voxel);
    }
    return cleaned.length > 0 ? cleaned : voxels;
  }
}
