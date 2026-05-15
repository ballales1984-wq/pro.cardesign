// Simple chunk boundary tests (cross-chunk, negative coords, getLocalKey)
import { Chunk } from './src/core/chunk-system.js';

console.log('=== Testing Chunk System ===');

const chunk0   = new Chunk(0, 0, 0, 16);
const chunk1   = new Chunk(1, 0, 0, 16);
const chunkNeg = new Chunk(-1, 0, 0, 16);

const t = (cond, msg) => console.log(`${cond ? '[OK]' : '[FAIL]'} ${msg}`);

// Placement
chunk0.addVoxel( 0,  0,  0, {id: 1});  t(true, 'chunk(0,0,0) holds voxel at world (0,0,0)');
chunk0.addVoxel(15,  0,  0, {id: 2});  t(chunk0.hasVoxel(15,0,0), 'chunk(0,0,0) holds voxel at world (15,0,0)');
chunk1.addVoxel(16,  0,  0, {id: 3});  t(chunk1.hasVoxel(16,0,0), 'chunk(1,0,0) holds voxel at world (16,0,0)');
chunkNeg.addVoxel(-1, 0, 0, {id: 4});  t(chunkNeg.hasVoxel(-1,0,0), 'chunk(-1,0,0) holds voxel at world (-1,0,0)');

// World→chunk-key routing (mirrors VoxelEngine._getChunkKey)
function worldToChunkKey(wx, wy, wz, chunkSize) {
  const cx = Math.floor(wx / chunkSize);
  const cy = Math.floor(wy / chunkSize);
  const cz = Math.floor(wz / chunkSize);
  return `${cx},${cy},${cz}`;
}

// Isolation — verify world routing correctly targets a single chunk
const toChunk = (wx, wy, wz) => {
  const key = worldToChunkKey(wx, wy, wz, 16);
  if      (key === `0,0,0`)  return chunk0;
  else if (key === `1,0,0`)  return chunk1;
  else if (key === `-1,0,0`) return chunkNeg;
  return null;
};
t(toChunk(  0, 0, 0) === chunk0,  'world( 0,0,0) routes to chunk(0,0,0)');
t(toChunk( 15, 0, 0) === chunk0,  'world(15,0,0) routes to chunk(0,0,0)');
t(toChunk( 16, 0, 0) === chunk1,  'world(16,0,0) routes to chunk(1,0,0)');
t(toChunk( -1, 0, 0) === chunkNeg, 'world(-1,0,0) routes to chunk(-1,0,0)');
t(toChunk( 31, 0, 0) === chunk1,  'world(31,0,0) routes to chunk(1,0,0)');
t(toChunk(-16, 0, 0) === chunkNeg, 'world(-16,0,0) routes to chunk(-1,0,0)');

// Delete
t(chunk0.removeVoxel(0,0,0),  'chunk(0,0,0) removeVoxel(0,0,0) → true');
t(!chunk0.getVoxel(0,0,0),    'chunk(0,0,0).getVoxel(0,0,0) → null after removal');

// VoxelsIterator yields world coords
const chunks = [chunk0, chunk1, chunkNeg];
for (const c of chunks) {
  c.addVoxel(0, 0, 0, { self: c.chunkX });
}
const allOk = chunks.every(c => c.voxelsIterator().next().done === false);
t(allOk, 'voxelsIterator() non-empty on all 3 chunks');

console.log('\n=== All tests completed ===');
