/**
 * VideoKeyframeExtraction - Extracts keyframes and transformations from video input
 * Strategy: keyframe + transformations, not full frame storage
 */
export class VideoKeyframeExtraction {
  constructor(voxelEngine, proceduralEngine = null) {
    this.voxelEngine = voxelEngine;
    this.proceduralEngine = proceduralEngine;
    this.keyframes = new Map();
    this.currentKeyframeIndex = 0;
    this._histogramCache = new Map(); // Cache histograms for scene change detection
  }

  /**
   * Extract keyframes from video file with proper video seeking
   * Strategy: extract on scene change or interval
   */
  async extractKeyframes(videoFile, options = {}) {
    const interval = options.interval || 30; // seconds between keyframes
    const sensitivity = options.sensitivity || 0.3; // scene change threshold
    const histogramSamples = options.histogramSamples || 16; // colors per channel for histogram

    const video = await this._loadVideo(videoFile);
    const duration = video.duration || 0;

    const keyframeList = [];
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    // Sample frames at intervals + scene change detection
    for (let t = 0; t < duration; t += interval) {
      const shouldExtract = await this._checkSceneChange(video, t, sensitivity, histogramSamples);
      if (shouldExtract || t === 0) {
        const frame = await this._captureFrame(video, t, canvas);
        const rules = await this._frameToRules(frame);
        const camera = this._estimateCameraTransform(frame);

        keyframeList.push({
          time: Math.round(t * 1000) / 1000,
          frame: { width: frame.width, height: frame.height },
          rules,
          camera,
          thumbnail: this._generateThumbnail(canvas),
          histogram: this._histogramCache.get(t)
        });
      }
    }

    this.keyframes = new Map(keyframeList.map(kf => [kf.time, kf]));
    return keyframeList;
  }

  /**
   * Load video element from file with proper dimensions
   */
  _loadVideo(file) {
    return new Promise((resolve, reject) => {
      const video = document.createElement('video');
      video.preload = 'metadata';
      video.muted = true;
      video.playsInline = true;
      video.onloadedmetadata = () => resolve(video);
      video.onerror = (e) => reject(new Error(`Video load error: ${e.message || 'Unknown error'}`));
      video.src = URL.createObjectURL(file);
    });
  }

  /**
   * Capture frame at specific time with proper seeking
   * Waits for seeked event before drawing frame
   */
  async _captureFrame(video, time, canvas) {
    return new Promise((resolve, reject) => {
      const onSeeked = () => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        
        const width = video.videoWidth || 256;
        const height = video.videoHeight || 256;
        canvas.width = width;
        canvas.height = height;
        
        try {
          const ctx = canvas.getContext('2d');
          ctx.clearRect(0, 0, width, height);
          ctx.drawImage(video, 0, 0, width, height);
          resolve(canvas);
        } catch (e) {
          reject(new Error(`Frame capture error at ${time}s: ${e.message}`));
        }
      };
      
      const onError = (e) => {
        video.removeEventListener('seeked', onSeeked);
        video.removeEventListener('error', onError);
        reject(new Error(`Video seek error at ${time}s: ${e.message || 'Seek failed'}`));
      };
      
      video.addEventListener('seeked', onSeeked);
      video.addEventListener('error', onError);
      
      // Request seek to time
      video.currentTime = time;
      
      // Fallback timeout for browsers that don't fire seeked reliably
      setTimeout(() => {
        if (video.readyState >= 2) {
          onSeeked();
        }
      }, 500);
    });
  }

  /**
   * Compute frame histogram for scene change detection
   */
  _computeHistogram(frame, bins = 16) {
    const ctx = frame.getContext('2d');
    const imageData = ctx.getImageData(0, 0, frame.width, frame.height);
    const data = imageData.data;
    
    const histogram = new Array(bins * bins * bins).fill(0);
    const binSize = Math.floor(256 / bins);
    
    for (let i = 0; i < data.length; i += 4) {
      const r = Math.floor(data[i] / binSize);
      const g = Math.floor(data[i + 1] / binSize);
      const b = Math.floor(data[i + 2] / binSize);
      const idx = (r * bins + g) * bins + b;
      if (idx < histogram.length) histogram[idx]++;
    }
    
    // Normalize
    const total = data.length / 4;
    for (let i = 0; i < histogram.length; i++) {
      histogram[i] = histogram[i] / total;
    }
    
    return histogram;
  }

  /**
   * Compare histograms using Bhattacharyya distance
   */
  _compareHistograms(h1, h2) {
    let similarity = 0;
    const bins = h1.length;
    
    for (let i = 0; i < bins; i++) {
      similarity += Math.sqrt(h1[i] * h2[i]);
    }
    
    // Convert to distance (0 = identical, 1 = completely different)
    return 1 - similarity;
  }

  /**
   * Check for scene change using histogram comparison
   */
  async _checkSceneChange(video, time, sensitivity, bins = 16) {
    const prevTime = time - 30; // Compare with frame 30s earlier
    
    if (prevTime < 0) return true; // Always extract first frame
    
    // Get cached histogram or compute
    let prevHist = this._histogramCache.get(prevTime);
    if (!prevHist) {
      const prevFrame = await this._captureFrame(video, prevTime, document.createElement('canvas'));
      prevHist = this._computeHistogram(prevFrame, bins);
      this._histogramCache.set(prevTime, prevHist);
    }
    
    // Capture current frame
    const canvas = document.createElement('canvas');
    const currFrame = await this._captureFrame(video, time, canvas);
    const currHist = this._computeHistogram(currFrame, bins);
    this._histogramCache.set(time, currHist);
    
    // Compare histograms
    const distance = this._compareHistograms(prevHist, currHist);
    
    // Scene change detected if distance exceeds threshold
    return distance > sensitivity;
  }

  /**
   * Convert frame to procedural rules using AI
   */
  async _frameToRules(frame) {
    if (!this.proceduralEngine) return [];

    // Use depth estimation + segmentation from Phase 7
    const { DepthEstimation, ObjectSegmentation, ProceduralRuleGeneration } = 
      await import('./depth-estimation.js');

    const depth = new DepthEstimation(this.voxelEngine);
    const segmentation = new ObjectSegmentation();

    try {
      // Convert canvas to image for processing
      const imageBlob = await new Promise(resolve => frame.toBlob(resolve, 'image/jpeg'));
      const file = new File([imageBlob], 'frame.jpg', { type: 'image/jpeg' });
      
      // Generate voxels from depth estimation
      const voxels = await depth.buildFromImage(file);
      
      // Segment objects
      const objects = await segmentation.segmentImage(frame);
      
      // Generate rules from segmented objects
      const prg = new ProceduralRuleGeneration(this.voxelEngine, this.proceduralEngine);
      return prg.generateFromAnalysis({ objects, voxels });
    } catch (e) {
      console.warn('AI processing failed, returning empty rules:', e.message);
      return [];
    }
  }

  /**
   * Estimate camera transform from frame analysis
   */
  _estimateCameraTransform(frame) {
    // Detect perspective from frame content
    // For now, use default but could analyze vanishing points
    return {
      position: [0, 50, 100],
      rotation: [0, 0, 0],
      fov: 75
    };
  }

  /**
   * Generate thumbnail data URL
   */
  _generateThumbnail(canvas) {
    return canvas.toDataURL('image/jpeg', 0.5);
  }

  /**
   * Timeline: interpolate between keyframes
   */
  interpolate(time) {
    const times = Array.from(this.keyframes.keys()).sort((a, b) => a - b);
    if (times.length === 0) return null;

    let before = null, after = null;
    for (const t of times) {
      if (t <= time) before = { time: t, ...this.keyframes.get(t) };
      if (t > time) { after = { time: t, ...this.keyframes.get(t) }; break; }
    }

    if (!before || !after) return before || after;

    // Linear interpolation factor
    const factor = (time - before.time) / (after.time - before.time);

    return {
      time,
      interpolated: true,
      camera: this._lerpCamera(before.camera, after.camera, factor),
      rules: this._lerpRules(before.rules, after.rules, factor)
    };
  }

  _lerpCamera(cam1, cam2, t) {
    return {
      position: cam1.position.map((v, i) => v + (cam2.position[i] - v) * t),
      rotation: cam1.rotation.map((v, i) => v + (cam2.rotation[i] - v) * t),
      fov: cam1.fov + (cam2.fov - cam1.fov) * t
    };
  }

  _lerpRules(r1, r2, t) {
    // Interpolate rule parameters for smooth transition
    const merged = {};
    const types = {};
    for (const r of (r1 || [])) {
      merged[r.name] = { ...r.params, factor: 0 };
      types[r.name] = r.type || 'ESTRUSIONE';
    }
    for (const r of (r2 || [])) {
      if (merged[r.name]) {
        merged[r.name].factor = 1;
      } else {
        merged[r.name] = { ...r.params, factor: 1 };
      }
      types[r.name] = r.type || types[r.name] || 'ESTRUSIONE';
    }
    return Object.entries(merged).map(([name, p]) => ({
      type: types[name],
      name: `interpolated_${name}`,
      params: p
    }));
  }

  /**
   * Export timeline to JSON
   */
  toJSON() {
    return {
      keyframes: Array.from(this.keyframes.entries()).map(([t, kf]) => ({
        time: t,
        ...kf,
        histogram: undefined // Exclude histogram from JSON (too large)
      })),
      duration: Math.max(...this.keyframes.keys()) || 0
    };
  }

  /**
   * Load timeline from JSON
   */
  fromJSON(data) {
    this.keyframes = new Map(data.keyframes.map(kf => [kf.time, kf]));
    return this;
  }

  /**
   * Clear cached histograms to free memory
   */
  clearCache() {
    this._histogramCache.clear();
  }

  /**
   * Seek to keyframe time and apply rules
   */
  async seekTo(time, onKeyframe = null) {
    const interpolated = this.interpolate(time);
    if (!interpolated) return null;

    // If this is an actual keyframe (not interpolated)
    if (!interpolated.interpolated) {
      this.currentKeyframeIndex = Array.from(this.keyframes.keys()).indexOf(time);
      if (onKeyframe) onKeyframe(interpolated);
    }

    return interpolated;
  }

/**
    * Get keyframe count
    */
   getKeyframeCount() {
     return this.keyframes.size;
   }

   /**
    * Get duration in seconds
    */
   getDuration() {
     return Math.max(...this.keyframes.keys()) || 0;
   }

   /**
    * Play timeline from start to end
    */
   async play(onFrame, fps = 30) {
     const duration = this.getDuration();
     const interval = 1000 / fps;
     const startTime = performance.now();
     
     return new Promise(resolve => {
       const tick = () => {
         const elapsed = (performance.now() - startTime) / 1000;
         if (elapsed >= duration) {
           resolve();
           return;
         }
         
         const interpolated = this.interpolate(elapsed);
         if (onFrame) onFrame(interpolated, elapsed);
         
         setTimeout(tick, interval);
       };
       
       tick();
     });
   }

   // ── Parallel Extraction Support ────────────────────────────────────────────

   /**
    * Extract keyframes from multiple regions in parallel
    * Splits video into chunks for concurrent processing
    */
   async extractKeyframesParallel(videoFile, options = {}) {
     const interval = options.interval || 30;
     const regions = options.regions || 4; // Number of parallel regions

     const video = await this._loadVideo(videoFile);
     const duration = video.duration || 0;

     // Create time segments for parallel processing
     const segmentDuration = duration / regions;
     const promises = [];

     for (let r = 0; r < regions; r++) {
       const start = r * segmentDuration;
       const end = (r + 1) * segmentDuration;
       promises.push(this._extractSegment(video, start, end, interval));
     }

     const allKeyframes = await Promise.all(promises);
     const mergedKeyframes = this._mergeKeyframes(allKeyframes.flat());

     this.keyframes = new Map(mergedKeyframes.map(kf => [kf.time, kf]));
     return mergedKeyframes;
   }

   /**
    * Extract keyframes from a video segment
    */
   async _extractSegment(video, start, end, interval) {
     const segmentKeyframes = [];
     for (let t = start; t < end; t += interval) {
       if (t >= end) break;
       const frame = await this._captureFrame(video, t, document.createElement('canvas'));
       const rules = await this._frameToRules(frame);
       const camera = this._estimateCameraTransform(frame);

       segmentKeyframes.push({
         time: Math.round(t * 1000) / 1000, // Round to avoid floating point issues
         frame: { width: frame.width, height: frame.height },
         rules,
         camera,
         region: Math.floor(start / (end - start))
       });
     }
     return segmentKeyframes;
   }

   /**
    * Merge keyframes, removing duplicates and sorting by time
    */
   _mergeKeyframes(allKeyframes) {
     const seen = new Set();
     const merged = [];

     for (const kf of allKeyframes) {
       const key = Math.round(kf.time);
       if (!seen.has(key)) {
         seen.add(key);
         merged.push(kf);
       }
     }

     return merged.sort((a, b) => a.time - b.time);
   }
}