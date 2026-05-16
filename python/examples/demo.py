"""
Example script demonstrating the use of the voxelengine module for a simple FEM problem.
"""

import voxelengine
import numpy as np

def main():
    print("=== Voxel Engine FEM Example ===")
    
    # Create some voxels
    voxels = []
    for x in range(3):
        for y in range(3):
            for z in range(3):
                v = voxelengine.Voxel(x, y, z)
                # Assign material based on position (simple example)
                if (x + y + z) % 2 == 0:
                    v.set_material(1)  # e.g., aluminum
                else:
                    v.set_material(2)  # e.g., titanium
                voxels.append(v)
    
    print(f"Created {len(voxels)} voxels")
    
    # Create a simple stiffness matrix (for demonstration)
    # In a real FEM application, this would be assembled from the voxel mesh
    size = 9  # 3x3x3 voxels -> 9 degrees of freedom (simplified)
    K = voxelengine.StiffnessMatrix(size)
    
    # Set up a simple stiffness matrix (diagonal for simplicity)
    for i in range(size):
        K.set_value(i, i, float(i + 1))  # Different stiffness values
    
    # Create force vector
    force = [float(i + 1) for i in range(size)]
    print(f"Force vector: {force}")
    
    # Solve
    solver = voxelengine.FemSolver(K)
    displacement = solver.solve(force)
    print(f"Displacement: {displacement}")
    
    # Show some voxel info
    print("\nFirst few voxels:")
    for i, v in enumerate(voxels[:3]):
        print(f"  Voxel {i}: {v.info()}")

if __name__ == "__main__":
    main()