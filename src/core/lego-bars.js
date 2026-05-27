export class LegoBar {
  constructor(id, name, length, axis, thickness, color) {
    this.id = id;
    this.name = name;
    this.length = length;
    this.axis = axis;
    this.thickness = thickness;
    this.color = color;
  }

  generateVoxels() {
    const voxels = [];
    const crossSection = this.thickness + 1;
    for (let i = 0; i < this.length; i++) {
      for (let y = 0; y < crossSection; y++) {
        for (let z = 0; z < crossSection; z++) {
          if (this.axis === 'x') {
            voxels.push({ x: i, y, z, color: this.color });
          } else if (this.axis === 'y') {
            voxels.push({ x: 0, y: i, z, color: this.color });
          } else {
            voxels.push({ x: 0, y, z: i, color: this.color });
          }
        }
      }
    }
    return voxels;
  }
}

export class LegoBarsLibrary {
  constructor() {
    this.bars = [];
    const axes = ['x', 'y', 'z'];
    let id = 1000;
    for (const axis of axes) {
      for (let length = 2; length <= 11; length++) {
        const thickness = 2;
        const name = `Bar ${length} ${axis.toUpperCase()}`;
        const color = 0xff0000;
        this.bars.push(new LegoBar(id++, name, length, axis, thickness, color));
      }
    }
  }

  getAll() {
    return this.bars;
  }

  get(id) {
    return this.bars.find(b => b.id === id);
  }

  createInstance(barDef, position) {
    const voxels = barDef.generateVoxels();
    return voxels.map(v => ({ ...v, x: v.x + position.x, y: v.y + position.y, z: v.z + position.z }));
  }
}