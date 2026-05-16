# Initialize the voxelengine package
# This makes the C++ extension available as voxelengine
try:
    import voxelengine
    print("Successfully imported voxelengine module")
except ImportError as e:
    print(f"Failed to import voxelengine: {e}")
    print("Make sure the module is compiled and in your Python path")