#pragma once

#include <array>
#include <string>

class Material {
public:
    Material(float density, float youngModulus);
    ~Material() = default;

    float density() const;
    float youngModulus() const;
    std::string info() const;

private:
    float density_;
    float youngModulus_; // in Pascals
};