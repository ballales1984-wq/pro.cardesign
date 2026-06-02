/**
 * DepthEstimation - AI-based 2D image to depth map conversion using ONNX Runtime
 * ObjectSegmentation - SAM-based object segmentation
 */
let ortModule = null;
let ortPromise = import('onnxruntime-web')
  .then(m => { ortModule = m; return m; })
  .catch(err => {
    console.warn('onnxruntime-web import failed:', err.message);
    return null;
  });

function getOrt() {
  return ortModule ? Promise.resolve(ortModule) : ortPromise;
}

export class DepthEstimation {
  constructor(voxelEngine) {
    this.voxelEngine = voxelEngine;
    this.session = null;
    this.modelLoaded = false;
    this.modelPath = '/models/midas_small.onnx';
  }

  async loadModel() {
    if (this.modelLoaded) return true;
    try {
      const ort = await getOrt();
      if (ort && ort.InferenceSession) {
        this.session = await ort.InferenceSession.create(this.modelPath, {
          executionProviders: ['wasm'],
          intraOpNumThreads: 1
        });
        this.modelLoaded = true;
        return true;
      }
      this.modelLoaded = false;
      return false;
    } catch (err) {
      console.warn('ONNX model load failed, falling back to simple depth estimation:', err.message);
      this.modelLoaded = false;
      return false;
    }
  }

  async estimateDepthFromImage(file, targetSize = 256) {
    const img = await this._loadImage(file);
    let depthMap;
    let modelUsed = 'fallback';

    if (await this.loadModel()) {
      modelUsed = 'onnx';
      const tensor = await this._imageToTensor(img, targetSize);
      depthMap = await this._runONNXModel(tensor, img.width, img.height);
    } else {
      depthMap = this._fallbackDepthEstimation(img);
    }

    return { depthMap, meta: { modelUsed, width: depthMap.width, height: depthMap.height } };
  }

  async buildFromImage(file, options = {}) {
    const { depthMap, meta } = await this.estimateDepthFromImage(file, options.depthTargetSize);
    const voxelSize = options.voxelSize || this.voxelEngine?.voxelSize || 1;
    const voxels = this.depthToVoxels(depthMap, voxelSize, {
      gridResolution: options.gridResolution || 32,
      maxDepthVoxels: options.maxDepthVoxels || 20,
      minThreshold: options.minThreshold || 0.05
    });

    if (voxels.length === 0) {
      voxels.push({ x: 0, y: 0, z: 0, material: 'steel' });
    }
    return { voxels, meta };
  }

  _loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  async _imageToTensor(img, targetSize = 256) {
    const ort = await getOrt();
    if (!ort || !ort.Tensor) {
      throw new Error('onnxruntime-web unavailable for tensor creation');
    }

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = targetSize;
    canvas.height = targetSize;
    ctx.drawImage(img, 0, 0, targetSize, targetSize);
    
    const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
    const data = new Float32Array(1 * 3 * targetSize * targetSize);
    
    for (let i = 0; i < targetSize * targetSize; i++) {
      data[i] = imageData.data[i * 4] / 255;           // R
      data[targetSize * targetSize + i] = imageData.data[i * 4 + 1] / 255; // G
      data[2 * targetSize * targetSize + i] = imageData.data[i * 4 + 2] / 255; // B
    }
    
    return new ort.Tensor('float32', data, [1, 3, targetSize, targetSize]);
  }

  async _runONNXModel(inputTensor, origW, origH) {
    const feeds = { 'input': inputTensor };
    const results = await this.session.run(feeds);

    const depthData = results.depth_output ? results.depth_output.data : results[Object.keys(results)[0]].data;
    const depthArray = new Float32Array(depthData);
    const srcSize = inputTensor.dims[2] || 256;
    const srcWidth = srcSize;
    const srcHeight = inputTensor.dims[3] || 256;

    const depthMap = new Float32Array(origW * origH);
    for (let y = 0; y < origH; y++) {
      for (let x = 0; x < origW; x++) {
        const srcX = Math.floor((x / origW) * srcWidth);
        const srcY = Math.floor((y / origH) * srcHeight);
        const srcIdx = srcY * srcWidth + srcX;
        const dstIdx = y * origW + x;
        depthMap[dstIdx] = depthArray[srcIdx];
      }
    }

    return { width: origW, height: origH, data: depthMap };
  }

  _fallbackDepthEstimation(img) {
    const width = Math.min(img.width || 64, 64);
    const height = Math.min(img.height || 64, 64);
    const data = new Float32Array(width * height);
    
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = width;
    canvas.height = height;
    ctx.drawImage(img, 0, 0, width, height);
    
    const imageData = ctx.getImageData(0, 0, width, height);
    for (let i = 0; i < width * height; i++) {
      const gray = 0.299 * imageData.data[i * 4] + 
                 0.587 * imageData.data[i * 4 + 1] + 
                 0.114 * imageData.data[i * 4 + 2];
      data[i] = gray / 255 * 50 + 10;
    }
    return { width, height, data };
  }

  depthToVoxels(depthMap, voxelSize = 1, opts = {}) {
    const voxels = [];
    const gridResolution = opts.gridResolution || 64;
    const maxDepthVoxels = opts.maxDepthVoxels || 24;
    const minThreshold = opts.minThreshold ?? 0.02;

    const width = depthMap.width;
    const height = depthMap.height;
    const stepX = Math.max(1, Math.floor(width / gridResolution));
    const stepY = Math.max(1, Math.floor(height / gridResolution));

    const maxDepth = Math.max(...depthMap.data);
    const minDepth = Math.min(...depthMap.data);
    const depthRange = Math.max(maxDepth - minDepth, 1e-5);

    const halfWidth = width / 2;
    const halfHeight = height / 2;

    for (let iy = 0; iy < height; iy += stepY) {
      for (let ix = 0; ix < width; ix += stepX) {
        const d = depthMap.data[iy * width + ix];
        const normalizedDepth = Math.min(1, Math.max(0, (d - minDepth) / depthRange));
        if (normalizedDepth < minThreshold) continue;

        const heightVoxels = Math.max(1, Math.round(normalizedDepth * maxDepthVoxels));
        const x = Math.round(((ix + stepX * 0.5) - halfWidth) * voxelSize / stepX);
        const z = Math.round(((iy + stepY * 0.5) - halfHeight) * voxelSize / stepY);

        for (let y = 0; y < heightVoxels; y++) {
          voxels.push({
            x,
            y,
            z,
            material: 'steel'
          });
        }
      }
    }
    return voxels;
  }
}

export class ObjectSegmentation {
  constructor() {
    this.encoderSession = null;
    this.decoderSession = null;
    this.modelLoaded = false;
  }

  async loadModel() {
    if (this.modelLoaded) return true;
    try {
      const ort = await getOrt();
      if (!ort || !ort.InferenceSession) {
        throw new Error('onnxruntime-web unavailable');
      }

      // Load quantized encoder + decoder (HuggingFace vietanhdev/segment-anything-onnx-models)
      this.encoderSession = await ort.InferenceSession.create('/models/sam_vit_b/sam_vit_b_01ec64.encoder.quant.onnx', {
        executionProviders: ['wasm'],
        intraOpNumThreads: 1
      });
      this.decoderSession = await ort.InferenceSession.create('/models/sam_vit_b/sam_vit_b_01ec64.decoder.quant.onnx', {
        executionProviders: ['wasm'],
        intraOpNumThreads: 1
      });
      this.modelLoaded = true;
      return true;
    } catch (err) {
      console.warn('SAM model load failed:', err.message);
      this.modelLoaded = false;
      return false;
    }
  }

  async segmentImage(img, points = null) {
    if (await this.loadModel()) {
      const embeddings = await this._runEncoder(img);
      return this._runDecoder(embeddings, points, img);
    }
    return this._fallbackSegmentation(img);
  }

  async _runEncoder(img) {
    const ort = await getOrt();
    if (!ort || !ort.Tensor) {
      throw new Error('onnxruntime-web unavailable for encoder');
    }
    const imageTensor = this._imageToTensor(img, 1024);
    const feeds = { 'images': imageTensor };
    const results = await this.encoderSession.run(feeds);
    return results.embeddings || results[Object.keys(results)[0]];
  }

  async _runDecoder(embeddings, points, img) {
    const ort = await getOrt();
    if (!ort || !ort.Tensor) {
      throw new Error('onnxruntime-web unavailable for decoder');
    }

    const height = img.height || img.naturalHeight || 256;
    const width = img.width || img.naturalWidth || 256;
    
    const pointCoords = points?.coords || new ort.Tensor('float32', new Float32Array([width / 2, height / 2]), [1, 1, 2]);
    const pointLabels = points?.labels || new ort.Tensor('float32', new Float32Array([1]), [1, 1]);
    const maskInput = new ort.Tensor('float32', new Float32Array(0), [1, 0, 0, 0]);
    const hasMaskInput = new ort.Tensor('float32', new Float32Array([0]), [1]);
    const origImSize = new ort.Tensor('float32', new Float32Array([width, height]), [2]);

    const feeds = {
      'image_embeddings': embeddings,
      'point_coords': pointCoords,
      'point_labels': pointLabels,
      'mask_input': maskInput,
      'has_mask_input': hasMaskInput,
      'orig_im_size': origImSize
    };
    const results = await this.decoderSession.run(feeds);
    const masks = Array.from(results.masks?.data || results[Object.keys(results)[0]]?.data || []);
    return this._masksToObjects(masks, width, height);
  }

  _masksToObjects(masks, width, height) {
    const objects = [];
    masks.forEach((mask, idx) => {
      const pixels = mask.reduce((sum, v, i) => sum + (v > 0.5 ? 1 : 0), 0);
      if (pixels > 100) {
        objects.push({
          id: idx,
          type: 'unknown',
          pixelArea: pixels,
          bbox: this._maskToBBox(mask, width, height)
        });
      }
    });
    return objects;
  }

  _maskToBBox(mask, width, height) {
    let minX = width, minY = height, maxX = 0, maxY = 0;
    for (let i = 0; i < mask.length; i++) {
      if (mask[i] > 0.5) {
        const x = i % width;
        const y = Math.floor(i / width);
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
    return [minX, minY, maxX - minX, maxY - minY];
  }

  _fallbackSegmentation(img) {
    return [{
      id: 0,
      type: 'object',
      pixelArea: (img.width || 64) * (img.height || 64),
      bbox: [0, 0, img.width || 64, img.height || 64],
      confidence: 0.5
    }];
  }
}

export class DepthFilter {
  constructor() {}

  filterDepthMap(depthMap, opts = {}) {
    const filtered = new Float32Array(depthMap.data.length);
    const w = depthMap.width;
    const h = depthMap.height;
    const kernelSize = opts.medianKernel || 3;

    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const idx = y * w + x;
        let sum = 0, count = 0;
        for (let dy = -kernelSize; dy <= kernelSize; dy++) {
          for (let dx = -kernelSize; dx <= kernelSize; dx++) {
            const ny = y + dy, nx = x + dx;
            if (ny >= 0 && ny < h && nx >= 0 && nx < w) {
              sum += depthMap.data[ny * w + nx];
              count++;
            }
          }
        }
        filtered[idx] = sum / count;
      }
    }

    // Normalize with 2nd and 98th percentile
    const sorted = [...filtered].sort((a, b) => a - b);
    const p2 = sorted[Math.floor(sorted.length * 0.02)];
    const p98 = sorted[Math.floor(sorted.length * 0.98)];
    const range = Math.max(p98 - p2, 1e-5);

    for (let i = 0; i < filtered.length; i++) {
      filtered[i] = Math.min(1, Math.max(0, (filtered[i] - p2) / range));
    }

    return { ...depthMap, data: filtered };
  }

  applyMask(depthMap, mask) {
    const masked = new Float32Array(depthMap.data.length);
    const w = depthMap.width;
    const h = depthMap.height;
    for (let i = 0; i < depthMap.data.length; i++) {
      masked[i] = mask[i] > 0.5 ? depthMap.data[i] : 0;
    }
    return { ...depthMap, data: masked };
  }
}

export class TSDFVolume {
  constructor(resolution, voxelSize = 1) {
    this.resolution = resolution;
    this.voxelSize = voxelSize;
    this.truncationDistance = resolution * voxelSize * 0.1;
    this.volume = new Float32Array(resolution * resolution * resolution).fill(1);
    this.weights = new Float32Array(resolution * resolution * resolution).fill(0);
  }

  voxelIndex(x, y, z) {
    const r = this.resolution;
    return (Math.floor(y) * r + Math.floor(z)) * r + Math.floor(x);
  }

  integrateDepth(depthMap, fx, fy, cx, cy) {
    const w = depthMap.width;
    const h = depthMap.height;
    const step = Math.max(1, Math.floor(Math.max(w, h) / this.resolution));
    const sceneDepth = this.resolution * this.voxelSize;

    for (let iy = 0; iy < h; iy += step) {
      for (let ix = 0; ix < w; ix += step) {
        const d = depthMap.data[iy * w + ix];
        if (d <= 0) continue;

        const x = ((ix - cx) * d / fx) * sceneDepth;
        const y = ((iy - cy) * d / fy) * sceneDepth;
        const z = d * sceneDepth;

        const vx = Math.floor((x + sceneDepth / 2) / this.voxelSize);
        const vy = Math.floor((y + sceneDepth / 2) / this.voxelSize);
        const vz = Math.floor(z / this.voxelSize);

        if (vx >= 0 && vx < this.resolution && vy >= 0 && vy < this.resolution && vz >= 0 && vz < this.resolution) {
          const idx = this.voxelIndex(vx, vy, vz);
          const sdf = Math.max(-1, Math.min(1, z / this.truncationDistance - 1));
          this.volume[idx] = Math.min(this.volume[idx], sdf);
          this.weights[idx]++;
        }
      }
    }
  }

  extractSurface(threshold = 0.2) {
    const voxels = [];
    const r = this.resolution;
    for (let z = 0; z < r; z++) {
      for (let y = 0; y < r; y++) {
        for (let x = 0; x < r; x++) {
          const idx = this.voxelIndex(x, y, z);
          if (this.volume[idx] < threshold && this.weights[idx] > 0) {
            voxels.push({
              x: x - r / 2,
              y: y - r / 2,
              z: z - r / 2,
              material: 'steel'
            });
          }
        }
      }
    }
    return voxels;
  }
}

export class SurfaceReconstruction {
  constructor(voxelEngine) {
    this.voxelEngine = voxelEngine;
    this.depthFilter = new DepthFilter();
    this.cameraParams = { fx: 500, fy: 500, cx: 128, cy: 128 };
  }

  setCameraParams(fx, fy, cx, cy) {
    this.cameraParams = { fx, fy, cx, cy };
  }

  async buildFromImage(file, options = {}) {
    const img = await this._loadImage(file);
    const w = Math.min(img.width || 256, 256);
    const h = Math.min(img.height || 256, 256);

    let depthMap;
    let modelUsed = 'fallback';

    const depthEstimation = new DepthEstimation(this.voxelEngine);
    if (await depthEstimation.loadModel()) {
      modelUsed = 'onnx';
      const tensor = await depthEstimation._imageToTensor(img, 256);
      depthMap = await depthEstimation._runONNXModel(tensor, 256, 256);
    } else {
      depthMap = depthEstimation._fallbackDepthEstimation(img);
    }

    // Post-process depth
    depthMap = this.depthFilter.filterDepthMap(depthMap, { medianKernel: 2 });

    // TSDF integration
    const resolution = options.gridResolution || 32;
    const voxelSize = options.voxelSize || 1;
    const tsdf = new TSDFVolume(resolution, voxelSize);

    const scaleX = w / 256;
    const scaleY = h / 256;
    tsdf.integrateDepth(depthMap, this.cameraParams.fx * scaleX, this.cameraParams.fy * scaleY, w / 2, h / 2);

    const voxels = tsdf.extractSurface(options.surfaceThreshold ?? 0.3);

    if (voxels.length === 0) {
      voxels.push({ x: 0, y: 0, z: 0, material: 'steel' });
    }

    return { voxels, meta: { modelUsed, width: w, height: h, method: 'tsdf-surface' } };
  }

  _loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }
}

export class ProceduralRuleGeneration {
  constructor(voxelEngine, proceduralEngine = null) {
    this.voxelEngine = voxelEngine;
    this.proceduralEngine = proceduralEngine;
  }

  generateFromAnalysis(analysis) {
    const rules = [];
    for (const obj of analysis.objects || []) {
      if (obj.bbox && obj.bbox.length >= 4) {
        const [x, y, w, h] = obj.bbox;
        const depth = obj.depth || 10;
        
        rules.push({
          type: 'ESTRUSIONE',
          name: `shape_${obj.id || rules.length}`,
          params: {
            profile: this._bboxToProfile([x, y, w, h]),
            height: depth,
            material: obj.material || 'steel'
          }
        });
      }
    }
    return rules;
  }

  _bboxToProfile(bbox) {
    const [x, y, w, h] = bbox;
    const profile = [];
    for (let px = x; px < x + w; px += 2) {
      for (let py = y; py < y + h; py += 2) {
        profile.push({ x: px, y: py });
      }
    }
    return profile;
  }

  async generateFromImage(file) {
    const depthEstimation = new DepthEstimation(this.voxelEngine);
    const result = await depthEstimation.buildFromImage(file);
    const voxels = Array.isArray(result) ? result : result.voxels;
    
    const segmentation = new ObjectSegmentation();
    const objects = await segmentation.segmentImage(await this._loadImage(file));
    
    const analysis = { objects: objects.map((obj, idx) => ({
      ...obj,
      depth: this._estimateObjectDepth(voxels, idx)
    })) };
    
    return this.generateFromAnalysis(analysis);
  }

  _loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  _estimateObjectDepth(voxels, objIdx) {
    const objVoxels = voxels.filter(v => v.module === undefined || v.module === objIdx);
    if (objVoxels.length === 0) return 10;
    return Math.max(...objVoxels.map(v => v.y)) / 10;
  }

  async applyRules(rules, proceduralEngine) {
    const engine = proceduralEngine || this.proceduralEngine;
    if (!engine) return;
    
    for (const rule of rules) {
      if (rule.type === 'ESTRUSIONE') {
        engine.extrude(rule.params.profile, rule.params.height, 'y', rule.params.material);
      } else if (rule.type === 'CUBO') {
        engine.cube(rule.params.size, rule.params.position, rule.params.material);
      }
    }
  }
}
