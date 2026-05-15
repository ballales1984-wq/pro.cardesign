// Test Chunk System
import { Chunk } from './src/core/chunk-system.js';

console.log('Testing Chunk System...');

const chunk = new Chunk(0, 0, 0, 16);

const voxelData = {
  x: 5, y: 10, z: 3,
  material: 'steel', module: 1,
  density: 7850, temperature: 293, damage: 0, scale: [1,1,1]
};

chunk.addVoxel(5, 10, 3, voxelData);
console.log('Has voxel at (5,10,3):', chunk.hasVoxel(5,10,3) ? 'OK'    : 'FAIL');
console.log('Has voxel at (0,0,0):', chunk.hasVoxel(0,0,0) ? 'FAIL (out of bounds)' : 'OK');

console.log('Local key for (5,10,3):', chunk.getLocalKey(5,10,3), '(expected: 5,10,3)');
console.log('Local key for (16,16,16):', chunk.getLocalKey(16,16,16), '(expected: 0,0,0)');

const removed = chunk.removeVoxel(5, 10, 3);
console.log('Remove voxel (5,10,3):', removed ? 'OK' : 'FAIL');
console.log('Has after removal:', chunk.hasVoxel(5,10,3) ? 'FAIL' : 'OK');

chunk.addVoxel(1, 1, 1, { t: 'a' });
chunk.addVoxel(2, 2, 2, { t: 'b' });
let count = 0;
for (const {x,y,z,voxelData} of chunk.voxelsIterator()) count++;
console.log('Iterator count:', count, '(expected 2)');

console.log('chunk.size():', chunk.size(), '(expected 2)');
chunk.clear();
console.log('size after clear():', chunk.size(), '(expected 0)');

console.log('\nChunk System tests completed!');
