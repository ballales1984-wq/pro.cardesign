#pragma once

#include <array>
#include <string>
#include <iostream>

class Voxel {
public:
    Voxel(int x, int y, int z);
    ~Voxel() = default;

    void setMaterial(int materialId);
    int getMaterialId() const;
    std::array<int, 3> getPosition() const;
    std::string info() const;

private:
    std::array<int, 3> position_;
    int materialId_; // index to material library
};