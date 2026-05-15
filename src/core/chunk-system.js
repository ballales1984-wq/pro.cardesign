export class Chunk {
  /**
   * @param {number} chunkX - Chunk X coordinate
   * @param {number} chunkY - Chunk Y coordinate
   * @param {number} chunkZ - Chunk Z coordinate
   * @param {number} [chunkSize=16] - Size of chunk in voxels
   */
  constructor(chunkX, chunkY, chunkZ, chunkSize = 16) {
    this.chunkX = chunkX;
    this.chunkY = chunkY;
    this.chunkZ = chunkZ;
    this.chunkSize = chunkSize;
    /** @type {Map<string, import('./voxel-engine.js').VoxelData>} */
    this.voxels = new Map(); // local key -> voxelData
  }

  /**
   * Get local key within chunk for world voxel coordinates
   * @param {number} x - World voxel X
   * @param {number} y - World voxel Y
   * @param {number} z - World voxel Z
   * @returns {string} Local key "lx,ly,lz"
   */
  getLocalKey(x, y, z) {
    const chunkSize = this.chunkSize;
    // Using modulo that works for negative numbers
    const lx = ((x % chunkSize) + chunkSize) % chunkSize;
    const ly = ((y % chunkSize) + chunkSize) % chunkSize;
    const lz = ((z % chunkSize) + chunkSize) % chunkSize;
    return `${lx},${ly},${lz}`;
  }

  /**
   * Get voxel data at world coordinates
   * @param {number} x - World voxel X
   * @param {number} y - World voxel Y
   * @param {number} z - World voxel Z
   * @returns {import('./voxel-engine.js').VoxelData|null}
   */
  getVoxel(x, y, z) {
    const key = this.getLocalKey(x, y, z);
    return this.voxels.get(key) || null;
  }

  /**
   * Add or replace voxel data at world coordinates
   * @param {number} x - World voxel X
   * @param {number} y - World voxel Y
   * @param {number} z - World voxel Z
   * @param {import('./voxel-engine.js').VoxelData} voxelData
   */
  addVoxel(x, y, z, voxelData) {
    const key = this.getLocalKey(x, y, z);
    this.voxels.set(key, voxelData);
  }

  /**
   * Remove voxel at world coordinates
   * @param {number} x - World voxel X
   * @param {number} y - World voxel Y
   * @param {number} z - World voxel Z
   * @returns {boolean} True if voxel existed and was removed
   */
  removeVoxel(x, y, z) {
    const key = this.getLocalKey(x, y, z);
    return this.voxels.delete(key);
  }

  /**
   * Check if voxel exists at world coordinates
   * @param {number} x - World voxel X
   * @param {number} y - World voxel Y
   * @param {number} z - World voxel Z
   * @returns {boolean}
   */
  hasVoxel(x, y, z) {
    const key = this.getLocalKey(x, y, z);
    return this.voxels.has(key);
  }

  /**
   * Iterator over all voxels in chunk yielding world coordinates and data
   * @yields {{x:number,y:number,z:number,voxelData:import('./voxel-engine.js').VoxelData}}
   */
  *voxelsIterator() {
    for (const [key, voxelData] of this.voxels) {
      const [lx, ly, lz] = key.split(',').map(Number);
      const wx = lx + this.chunkX * this.chunkSize;
      const wy = ly + this.chunkY * this.chunkSize;
      const wz = lz + this.chunkZ * this.chunkSize;
      yield { x: wx, y: wy, z: wz, voxelData };
    }
  }

  /**
   * Get number of voxels in chunk
   * @returns {number}
   */
  size() {
    return this.voxels.size;
  }

  /**
   * Clear all voxels in chunk
   */
  clear() {
    this.voxels.clear();
  }
}