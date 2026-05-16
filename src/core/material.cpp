#include "material.hpp"
#include <sstream>

Material::Material(float density, float youngModulus)
    : density_(density), youngModulus_(youngModulus) {}

float Material::density() const {
    return density_;
}

float Material::youngModulus() const {
    return youngModulus_;
}

std::string Material::info() const {
    std::ostringstream oss;
    oss << "Material(density: " << density_ << " kg/m³, Young's modulus: " << youngModulus_ << " Pa)";
    return oss.str();
}