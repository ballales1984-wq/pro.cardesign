cmake_minimum_required(VERSION 3.15)
project(VoxelEngine LANGUAGES CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

set(Python_EXECUTABLE "C:/Python314/python.exe" CACHE FILEPATH "Python interpreter" FORCE)
set(PYBIND11_FINDPYTHON NEW)

add_subdirectory(third_party/pybind11)

file(GLOB_RECURSE SOURCES 
    src/core/*.cpp 
    src/fem/*.cpp 
    src/utils/*.cpp
)

pybind11_add_module(voxelengine src/bindings/pybind_module.cpp ${SOURCES})

target_include_directories(voxelengine PRIVATE 
    src 
    include
    ${PYBIND11_INCLUDE_DIRS}
)

# Ottimizzazioni per rilascio
set(CMAKE_CXX_FLAGS_RELEASE "${CMAKE_CXX_FLAGS_RELEASE} /O2 /DNDEBUG")