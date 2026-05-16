#include "voxel.hpp"

Voxel::Voxel(int x, int y, int z)
    : position_{x, y, z}, materialId_(0) {}

void Voxel::setMaterial(int materialId) {
    materialId_ = materialId;
}

int Voxel::getMaterialId() const {
    return materialId_;
}

std::array<int, 3> Voxel::getPosition() const {
    return position_;
}

std::string Voxel::info() const {
    return "Voxel at (" + 
           std::to_string(position_[0]) + ", " +
           std::to_string(position_[1]) + ", " +
           std::to_string(position_[2]) + 
           ") with material ID: " + std::to_string(materialId_);
}