/**
 * Aerodynamics - Surface-based aerodynamics calculations
 * Calculates drag, lift coefficients from mesh geometry
 */
export class Aerodynamics {
  constructor(meshExporter) {
    this.meshExporter = meshExporter;
  }

  /**
   * Calculate frontal area from geometry
   */
  getFrontalArea(geometry, windDirection = 'z') {
    const pos = geometry.getAttribute('position');
    const index = geometry.getIndex();
    
    if (!pos || !index) return 0;
    
    // Project vertices onto plane perpendicular to wind direction
    const vertices = [];
    const axis = {x: 0, y: 1, z: 2 }[windDirection] || 2;
    
    for (let i = 0; i < index.count; i += 3) {
      const v1 = [pos.getX(index.getX(i)), pos.getY(index.getX(i)), pos.getZ(index.getX(i))];
      const v2 = [pos.getX(index.getX(i+1)), pos.getY(index.getX(i+1)), pos.getZ(index.getX(i+1))];
      const v3 = [pos.getX(index.getX(i+2)), pos.getY(index.getX(i+2)), pos.getZ(index.getX(i+2))];
      
      // Project to 2D (remove wind axis)
      const p1 = [v1[(axis+1)%3], v1[(axis+2)%3]];
      const p2 = [v2[(axis+1)%3], v2[(axis+2)%3]];
      const p3 = [v3[(axis+1)%3], v3[(axis+2)%3]];
      
      vertices.push(p1, p2, p3);
    }
    
    return this._calculateProjectedArea(vertices);
  }

  _calculateProjectedArea(vertices) {
    // Simple convex hull area approximation
    if (vertices.length < 3) return 0;
    
    // Find bounding box as approximation
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    
    for (const v of vertices) {
      minX = Math.min(minX, v[0]);
      maxX = Math.max(maxX, v[0]);
      minY = Math.min(minY, v[1]);
      maxY = Math.max(maxY, v[1]);
    }
    
    return (maxX - minX) * (maxY - minY) * 0.5;
  }

  /**
   * Calculate drag coefficient
   */
  calculateDrag(velocity, frontalArea, coefficient = 0.3) {
    const airDensity = 1.225; // kg/m³ at sea level
    const v = velocity || 10; // m/s default
    
    // Fd = 0.5 * ρ * v² * Cd * A
    const dragForce = 0.5 * airDensity * v * v * coefficient * frontalArea;
    return {
      force: dragForce,
      coefficient: coefficient,
      frontalArea: frontalArea
    };
  }

  /**
   * Calculate lift coefficient (basic estimate)
   */
  calculateLift(velocity, topArea, coefficient = 0.1) {
    const airDensity = 1.225;
    const v = velocity || 10;
    
    const liftForce = 0.5 * airDensity * v * v * coefficient * topArea;
    return {
      force: liftForce,
      coefficient: coefficient,
      topArea: topArea
    };
  }

  /**
   * Calculate Reynolds number
   */
  reynoldsNumber(velocity, length) {
    const nu = 1.5e-5; // kinematic viscosity of air
    return velocity * length / nu;
  }

  /**
   * Get aerodynamic properties summary
   */
  getSummary(voxels) {
    const volume = voxels.length;
    const estimatedArea = Math.pow(volume, 2/3);
    
    return {
      voxelCount: voxels.length,
      estimatedFrontalArea: estimatedArea,
      estimatedDragAt10ms: this.calculateDrag(10, estimatedArea).force
    };
  }
}