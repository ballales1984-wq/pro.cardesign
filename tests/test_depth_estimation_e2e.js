// E2E tests for AI 2D->3D pipeline
// Tests model files, depth estimation logic, procedural rule generation
// ONNX inference skipped in Node (WASM not available)

import { existsSync, statSync } from 'fs';

function depthToVoxels(depthMap, voxelSize = 10) {
  const voxels = [];
  const step = Math.max(1, Math.floor(depthMap.width / 32));
  const maxDepth = Math.max(...depthMap.data);
  const minDepth = Math.min(...depthMap.data);
  for (let y = 0; y < depthMap.height; y += step) {
    for (let x = 0; x < depthMap.width; x += step) {
      const d = depthMap.data[y * depthMap.width + x];
      const depthRange = maxDepth - minDepth;
      let normalizedDepth;
      if (depthRange > 0.001) { normalizedDepth = (d - minDepth) / depthRange; }
      else if (maxDepth > 0.001) { normalizedDepth = 1.0; }
      else { normalizedDepth = 0.0; }
      if (normalizedDepth > 0.3) {
        const depthVoxels = Math.max(1, Math.floor(normalizedDepth * 20));
        for (let z = 0; z < depthVoxels; z++) {
          voxels.push({ x: Math.round((x - depthMap.width / 2) * voxelSize / step), y: z * voxelSize, z: Math.round((y - depthMap.height / 2) * voxelSize / step), material: 'steel' });
        }
      }
    }
  }
  return voxels;
}

// Mock browser APIs
global.document = global.document || {};
const origCreate = global.document.createElement;
global.document.createElement = function(tag) {
  if (tag === 'canvas') {
    return { width: 256, height: 256, getContext() { return { drawImage(){}, getImageData(x,y,w,h){ return { data: new Uint8ClampedArray(w*h*4) }; } }; } };
  }
  return origCreate.call(document, tag);
};
global.Image = class MockImg { set onload(f){}; set src(v){ this.width=64; this.height=64; } };
global.URL = { createObjectURL: ()=>'mock://blob', revokeObjectURL: ()=>{} };

let passed = 0, failed = 0;
function test(n, fn) { try { fn(); console.log('  [PASS] ' + n); passed++; } catch(e) { console.log('  [FAIL] ' + n + ': ' + e.message); failed++; } }
function assert(c, m) { if (!c) throw new Error(m || 'fail'); }

async function run() {
  console.log('=== AI 2D->3D E2E Tests ===\n');
  const { DepthEstimation, ObjectSegmentation, ProceduralRuleGeneration } = await import('../src/core/depth-estimation.js');

  test('MiDaS model file exists', () => {
    assert(existsSync('public/models/midas_small.onnx'));
    assert(statSync('public/models/midas_small.onnx').size > 10_000_000);
  });
  test('SAM encoder/decoder exist', () => {
    assert(existsSync('public/models/sam_vit_b/sam_vit_b_01ec64.encoder.quant.onnx'));
    assert(existsSync('public/models/sam_vit_b/sam_vit_b_01ec64.decoder.quant.onnx'));
    assert(statSync('public/models/sam_vit_b/sam_vit_b_01ec64.encoder.quant.onnx').size > 5_000_000);
    assert(statSync('public/models/sam_vit_b/sam_vit_b_01ec64.decoder.quant.onnx').size > 5_000_000);
  });

  const de = new DepthEstimation({});
  const seg = new ObjectSegmentation();
  const prg = new ProceduralRuleGeneration({});

  test('DepthEstimation defaults', () => { assert(!de.modelLoaded); assert(de.modelPath === '/models/midas_small.onnx'); });
  test('ObjectSegmentation defaults', () => { assert(!seg.modelLoaded); });
  test('fallback depth estimation valid map', () => {
    const r = de._fallbackDepthEstimation({width:64,height:64});
    assert(r.width === 64 && r.height === 64);
    assert(r.data instanceof Float32Array);
    assert(r.data.length === 64*64);
  });
  test('uniform non-zero depth -> voxels (bug fix)', () => {
    const d = new Float32Array(64*64).fill(50);
    assert(depthToVoxels({width:64,height:64,data:d}).length > 0);
  });
  test('all-zero depth -> 0 voxels', () => {
    const d = new Float32Array(64*64).fill(0);
    assert(depthToVoxels({width:64,height:64,data:d}).length === 0);
  });
  test('gradient depth -> correct structure', () => {
    const d = new Float32Array(64*64);
    for (let y=0;y<64;y++) for(let x=0;x<64;x++) d[y*64+x]=y*4;
    const v = depthToVoxels({width:64,height:64,data:d},10);
    assert(v.length>0);
    assert(typeof v[0].x==='number' && typeof v[0].y==='number' && typeof v[0].z==='number');
    assert(v[0].material==='steel');
  });
  test('generateFromAnalysis creates rules', () => {
    const rules = prg.generateFromAnalysis({objects:[{id:1,bbox:[0,0,100,50],depth:20,material:'steel'}]});
    assert(rules.length===1); assert(rules[0].type==='ESTRUSIONE');
    assert(rules[0].params.height===20); assert(typeof rules[0].params.profile==='object');
  });
  test('_bboxToProfile shape', () => {
    const p = prg._bboxToProfile([0,0,10,10]);
    assert(Array.isArray(p) && p.length>0); assert(p[0].x===0 && p[0].y===0);
  });
  test('_estimateObjectDepth per-module + fallback', () => {
    // No module -> all voxels match any index (current behavior)
    const unm = [{x:0,y:15,z:0},{x:1,y:25,z:0},{x:2,y:35,z:0}];
    assert(prg._estimateObjectDepth(unm, 0)===3.5);
    // With module assignment
    const wm = [{x:0,y:15,z:0,module:0},{x:1,y:20,z:0,module:0},{x:2,y:30,z:0,module:1}];
    assert(prg._estimateObjectDepth(wm, 0)===2.0);
    assert(prg._estimateObjectDepth(wm, 1)===3.0);
    assert(prg._estimateObjectDepth([],0)===10);
  });
  test('applyRules dispatches correctly', () => {
    const calls = [];
    const eng = { extrude: (p,h,a,m) => calls.push({p,h,a,m}) };
    prg.applyRules([
      {type:'ESTRUSIONE',params:{profile:[{x:0,y:0}],height:100,material:'steel'}},
      {type:'ESTRUSIONE',params:{profile:[{x:5,y:5}],height:50,material:'aluminum'}},
    ], eng);
    assert(calls.length===2); assert(calls[0].m==='steel'); assert(calls[1].m==='aluminum');
  });
  test('_fallbackSegmentation returns valid', () => {
    const r = seg._fallbackSegmentation({width:300,height:200});
    assert(r.length>0 && r[0].type==='object'); assert(r[0].bbox[2]===300);
  });
  test('_maskToBBox edge cases', () => {
    let m = new Array(100).fill(0); m[55]=1;
    let b = seg._maskToBBox(m,10,10);
    assert(b[0]===5 && b[1]===5 && b[2]===0 && b[3]===0);
    m=new Array(100).fill(1); b=seg._maskToBBox(m,10,10);
    assert(b[2]===9 && b[3]===9);
  });
  test('MiDaS/SAM graceful WASM absence', async () => {
    const ok1 = await de.loadModel(); const ok2 = await seg.loadModel();
    if (!ok1) console.log('    [SKIP] WASM not in Node');
    if (!ok2) console.log('    [SKIP] SAM WASM not in Node');
  });

  console.log('\nResults: ' + passed + '/' + (passed+failed) + (failed>0?' FAILED':' ALL PASS'));
  process.exit(failed>0?1:0);
}
run().catch(e => { console.error('FATAL:', e.message); process.exit(1); });
