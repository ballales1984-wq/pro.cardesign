import { SymmetricReconstruction, reconstructSymmetric, analyzeSymmetry } from '../src/core/symmetric-reconstruction.js';

let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); console.log('  [PASS] ' + name); passed++;
  } catch(e) { console.log('  [FAIL] ' + name + ': ' + e.message); failed++; }
}
function assert(c, m) { if (!c) throw new Error(m || 'assertion failed'); }

console.log('=== SymmetricReconstruction Tests ===\n');

test('empty input returns 0 quality', () => {
  const result = reconstructSymmetric([]);
  assert(result.mirrorQuality === 0, 'empty → quality 0');
  assert(result.voxels.length === 0, 'empty → 0 voxels');
});

test('insufficient voxels returns 0 quality', () => {
  const result = reconstructSymmetric([{ x: 1, y: 0, z: 0 }]);
  assert(result.mirrorQuality === 0);
});

test('simple symmetric voxels reconstructed', () => {
  const voxels = [
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
    { x: 2, y: 0, z: 0 },
    { x: 3, y: 0, z: 0 },
    { x: 4, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
  ];
  const result = reconstructSymmetric(voxels, { axis: 'x' });
  assert(result.voxels.length >= voxels.length, 'output >= input, got ' + result.voxels.length);
  assert(result.mirroredCount > 0 || result.voxels.length === voxels.length, 'mirrored or all-inclusive');
  assert(typeof result.mirrorQuality === 'number', 'quality is number');
});

test('non-symmetric input produces lower quality', () => {
  const voxels = [
    { x: 0, y: 0, z: 0 },
    { x: 10, y: 5, z: 3 },
    { x: 20, y: 10, z: 7 },
  ];
  const result = reconstructSymmetric(voxels, { axis: 'x' });
  assert(result.mirrorQuality < 0.5, 'non-symmetric → low quality, got ' + result.mirrorQuality);
});

test('y axis symmetry works', () => {
  const voxels = [];
  for (let y = 0; y <= 6; y++) voxels.push({ x: 0, y, z: 0 });
  const result = reconstructSymmetric(voxels, { axis: 'y' });
  assert(result.mirrorQuality >= 0, 'y-symmetric → quality >= 0, got ' + result.mirrorQuality);
  assert(result.voxels.length >= voxels.length, 'output >= input');
});

test('z axis symmetry works', () => {
  const voxels = [];
  for (let z = 0; z <= 6; z++) voxels.push({ x: 0, y: 0, z });
  const result = reconstructSymmetric(voxels, { axis: 'z' });
  assert(result.mirrorQuality >= 0, 'z-symmetric → quality >= 0, got ' + result.mirrorQuality);
  assert(result.voxels.length >= voxels.length, 'output >= input');
});

test('mirrorVoxels preserves input', () => {
  const engine = new SymmetricReconstruction({ axis: 'x' });
  const voxels = [{ x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }];
  const result = engine.mirrorVoxels(voxels);
  assert(result.length >= voxels.length, 'mirror preserves input');
});

test('analyzeSymmetry returns structured result', () => {
  const analysis = analyzeSymmetry([{ x: 0, y: 0, z: 0 }, { x: 1, y: 0, z: 0 }, { x: 2, y: 0, z: 0 }], { axis: 'x' });
  assert(typeof analysis.isSymmetric === 'boolean', 'isSymmetric is boolean');
  assert(typeof analysis.quality === 'number', 'quality is number');
  assert(typeof analysis.recommendation === 'string', 'recommendation is string');
});

test('symmetryAxis is centered on range', () => {
  const voxels = [];
  for (let x = 0; x <= 4; x++) voxels.push({ x, y: 0, z: 0 });
  const result = reconstructSymmetric(voxels, { axis: 'x' });
  assert(result.symmetryAxis === 2.0, 'axis at center = 2.0, got ' + result.symmetryAxis);
});

test('dedup removes identical voxels', () => {
  const voxels = [
    { x: 0, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 1, y: 0, z: 0 },
  ];
  const result = reconstructSymmetric(voxels, { axis: 'x' });
  const keys = new Set(result.voxels.map(v => `${v.x},${v.y},${v.z}`));
  assert(keys.size === result.voxels.length, 'no duplicate voxels after dedup, size=' + keys.size + ' len=' + result.voxels.length);
});

test('car-shape: left-right symmetric', () => {
  const voxels = [];
  const hw = 100, hh = 20, hd = 10;
  for (let x = -hw; x <= hw; x += 10) {
    for (let y = 0; y <= hh; y += 10) {
      for (let z = 0; z <= hd; z += 10) {
        voxels.push({ x, y, z, material: 'steel' });
      }
    }
  }
  const result = reconstructSymmetric(voxels, { axis: 'x' });
  assert(result.voxels.length >= voxels.length, 'output >= input, got ' + result.voxels.length + ' vs ' + voxels.length);
  assert(result.symmetryAxis > -1 && result.symmetryAxis < 1, 'axis ≈ 0, got ' + result.symmetryAxis);
  assert(result.mirrorQuality > 0.5, 'quality should be high for symmetric shape, got ' + result.mirrorQuality);
});

test('exact mirror test: left side -50..0, right side 51..100', () => {
  const left = [];
  const right = [];
  for (let x = -50; x <= 0; x += 10) left.push({ x, y: 0, z: 0, material: 'steel' });
  for (let x = 51; x <= 100; x += 10) right.push({ x, y: 0, z: 0, material: 'steel' });
  const result = reconstructSymmetric([...left, ...right], { axis: 'x' });
  assert(result.voxels.length >= left.length + right.length, 'all voxels kept');
  assert(result.mirrorQuality > 0.5, 'quality > 0.5, got ' + result.mirrorQuality);
});

test('negative and positive coordinates handled', () => {
  const voxels = [
    { x: -10, y: 0, z: 0 },
    { x: -5, y: 0, z: 0 },
    { x: 0, y: 0, z: 0 },
    { x: 5, y: 0, z: 0 },
    { x: 10, y: 0, z: 0 },
  ];
  const result = reconstructSymmetric(voxels, { axis: 'x' });
  assert(result.symmetryAxis === 0, 'axis at 0, got ' + result.symmetryAxis);
  assert(result.voxels.length >= voxels.length, 'output >= input');
});

console.log('\nResults: ' + passed + '/' + (passed+failed) + (failed > 0 ? ' FAILED' : ' ALL PASS'));
process.exit(failed > 0 ? 1 : 0);
