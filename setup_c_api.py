from setuptools import setup, Extension
import sysconfig

physics_module = Extension(
    'physics_c_api',
    sources=['src/physics_c_api.cpp'],
    include_dirs=[sysconfig.get_path('include')],
)

setup(
    name='physics_c_api',
    version='1.0',
    ext_modules=[physics_module],
)