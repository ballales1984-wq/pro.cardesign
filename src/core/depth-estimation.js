/**
 * DepthEstimation - AI-based 2D image to depth map conversion using ONNX Runtime
 * ObjectSegmentation - SAM-based object segmentation
 */
import * as ort from 'onnxruntime-web';

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
      this.session = await ort.InferenceSession.create(this.modelPath, {
        executionProviders: ['wasm'],
        intraOpNumThreads: 1
      });
      this.modelLoaded = true;
      return true;
    } catch (err) {
      console.warn('ONNX model load failed, falling back to simple depth estimation:', err.message);
      this.modelLoaded = false;
      return false;
    }
  }

  async buildFromImage(file) {
    const img = await this._loadImage(file);
    const tensor = this._imageToTensor(img);
    
    let depthMap;
    if (await this.loadModel()) {
      depthMap = await this._runONNXModel(tensor, img.width, img.height);
    } else {
      depthMap = this._fallbackDepthEstimation(img);
    }
    
    return this.depthToVoxels(depthMap);
  }

  _loadImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  _imageToTensor(img, targetSize = 256) {
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
    
    // Resize depth map back to original dimensions via simple sampling
    const depthMap = new Float32Array(origW * origH);
    for (let y = 0; y < origH; y++) {
      for (let x = 0; x < origW; x++) {
        const srcIdx = Math.floor((y / origH) * 256) * 256 + Math.floor((x / origW) * 256);
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

  depthToVoxels(depthMap, voxelSize = 10) {
    const voxels = [];
    const step = Math.max(1, Math.floor(depthMap.width / 32));
    const maxDepth = Math.max(...depthMap.data);
    const minDepth = Math.min(...depthMap.data);
    
    for (let y = 0; y < depthMap.height; y += step) {
      for (let x = 0; x < depthMap.width; x += step) {
        const d = depthMap.data[y * depthMap.width + x];
        const normalizedDepth = (d - minDepth) / (maxDepth - minDepth + 0.001);
        
        if (normalizedDepth > 0.3) {
          const depthVoxels = Math.max(1, Math.floor(normalizedDepth * 20));
          for (let z = 0; z < depthVoxels; z++) {
            voxels.push({
              x: Math.round((x - depthMap.width / 2) * voxelSize / step),
              y: z * voxelSize,
              z: Math.round((y - depthMap.height / 2) * voxelSize / step),
              material: 'steel'
            });
          }
        }
      }
    }
    return voxels;
  }
}

export class ObjectSegmentation {
  constructor() {
    this.session = null;
    this.modelLoaded = false;
  }

  async loadModel() {
    if (this.modelLoaded) return true;
    try {
      this.session = await ort.InferenceSession.create('/models/sam_vit_b.onnx', {
        executionProviders: ['wasm'],
        intraOpNumThreads: 1
      });
      this.modelLoaded = true;
      return true;
    } catch (err) {
      console.warn('SAM model load failed:', err.message);
      return false;
    }
  }

  async segmentImage(img, points = null) {
    const imageTensor = this._imageToTensor(img);
    
    if (this.session && await this.loadModel()) {
      return this._runSAMModel(imageTensor, points);
    }
    
    return this._fallbackSegmentation(img);
  }

  _imageToTensor(img, targetSize = 256) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = targetSize;
    canvas.height = targetSize;
    ctx.drawImage(img, 0, 0, targetSize, targetSize);
    
    const imageData = ctx.getImageData(0, 0, targetSize, targetSize);
    const data = new Float32Array(1 * 3 * targetSize * targetSize);
    
    for (let i = 0; i < targetSize * targetSize; i++) {
      data[i] = imageData.data[i * 4] / 255;
      data[targetSize * targetSize + i] = imageData.data[i * 4 + 1] / 255;
      data[2 * targetSize * targetSize + i] = imageData.data[i * 4 + 2] / 255;
    }
    
    return new ort.Tensor('float32', data, [1, 3, targetSize, targetSize]);
  }

  async _runSAMModel(imageTensor, points) {
    const feeds = { 'image': imageTensor, 'points': points || new ort.Tensor('float32', new Float32Array(0), [0, 2]) };
    const results = await this.session.run(feeds);
    const masks = results.masks ? Array.from(results.masks.data) : [];
    
    return this._masksToObjects(masks, imageTensor.dims[3], imageTensor.dims[2]);
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
    const voxels = await depthEstimation.buildFromImage(file);
    
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