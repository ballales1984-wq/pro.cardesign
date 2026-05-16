"""
Test script for the voxelengine module.
This script assumes that the voxelengine module has been built and is available in the Python path.
"""

try:
    import voxelengine
    print("Successfully imported voxelengine")

    # Test Voxel
    v = voxelengine.Voxel(1, 2, 3)
    print("Voxel created:", v.info())
    v.set_material(5)
    print("After setting material:", v.info())

    # Test Material
    m = voxelengine.Material(7800.0, 210e9)  # steel
    print("Material:", m.info())
    print("Density:", m.density())
    print("Young's modulus:", m.young_modulus())

    # Test Triangle
    t = voxelengine.Triangle(
        [0.0, 0.0, 0.0],
        [1.0, 0.0, 0.0],
        [0.0, 1.0, 0.0]
    )
    print("Triangle:", t.info())
    print("Vertex 0:", t.get_vertex(0))
    t.set_vertex(0, [1.0, 1.0, 0.0])
    print("After setting vertex 0:", t.info())

    # Test FEM (placeholder)
    # We need a StiffnessMatrix to create a FemSolver
    K = voxelengine.StiffnessMatrix(3)
    # Set some values (identity matrix for simplicity)
    for i in range(3):
        K.set_value(i, i, 1.0)
    solver = voxelengine.FemSolver(K)
    force = [1.0, 2.0, 3.0]
    displacement = solver.solve(force)
    print("FEM solver displacement:", displacement)

except ImportError as e:
    print(f"Failed to import voxelengine: {e}")
except Exception as e:
    print(f"An error occurred during testing: {e}")