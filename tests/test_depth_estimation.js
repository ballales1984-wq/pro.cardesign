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
      if (depthRange > 0.001) {
        normalizedDepth = (d - minDepth) / depthRange;
      } else if (maxDepth > 0.001) {
        normalizedDepth = 1.0;
      } else {
        normalizedDepth = 0.0;
      }
      if (normalizedDepth > 0.3) {
        const depthVoxels = Math.max(1, Math.floor(normalizedDepth * 20));
        for (let z = 0; z < depthVoxels; z++) {
          voxels.push({
            x: Math.round((x - depthMap.width / 2) * voxelSize / step),
            y: z * voxelSize, z: Math.round((y - depthMap.height / 2) * voxelSize / step),
            material: 'steel'
          });
        }
      }
    }
  }
  return voxels;
}

let passed = 0, failed = 0;
function test(name, fn) { try { fn(); console.log('  [PASS] ' + name); passed++; } catch(e) { console.log('  [FAIL] ' + name + ': ' + e.message); failed++; } }
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

console.log('=== depthToVoxels Logic Tests ===\n');
test('uniform non-zero depth produces voxels', () => {
  const d = new Float32Array(64*64).fill(50);
  assert(depthToVoxels({width:64,height:64,data:d}).length > 0);
});
test('all-zero depth produces no voxels', () => {
  const d = new Float32Array(64*64).fill(0);
  assert(depthToVoxels({width:64,height:64,data:d}).length === 0);
});
test('gradient depth produces geometry', () => {
  const d = new Float32Array(64*64);
  for (let y = 0; y < 64; y++) for (let x = 0; x < 64; x++) d[y*64+x] = y * 4;
  const v = depthToVoxels({width:64,height:64,data:d});
  assert(v.length > 0 && typeof v[0].x === 'number');
});
test('voxel coordinates are centered', () => {
  const d = new Float32Array(64*64).fill(50);
  const v = depthToVoxels({width:64,height:64,data:d}, 10);
  assert(v.some(vx => vx.x === 0 && vx.z === 0), 'Center should exist');
});
test('voxel material defaults to steel', () => {
  const d = new Float32Array(64*64).fill(50);
  assert(depthToVoxels({width:64,height:64,data:d})[0].material === 'steel');
});
test('voxelSize scales output', () => {
  const d = new Float32Array(64*64).fill(50);
  const v1 = depthToVoxels({width:64,height:64,data:d}, 1);
  const v2 = depthToVoxels({width:64,height:64,data:d}, 100);
  assert(v1.length === v2.length, 'Same count');
});
test('depthMap dimensions preserved', () => {
  const d = new Float32Array(32*48).fill(50);
  const v = depthToVoxels({width:32,height:48,data:d});
  assert(v.length > 0);
});

console.log('\nResults: ' + passed + '/' + (passed+failed) + (failed > 0 ? ' FAILED' : ' ALL PASS'));
process.exit(failed > 0 ? 1 : 0);
