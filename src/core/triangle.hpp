#pragma once

#include <array>
#include <string>

class Triangle {
public:
    Triangle(std::array<double, 3> v1, std::array<double, 3> v2, std::array<double, 3> v3);
    ~Triangle() = default;

    std::array<double, 3> getVertex(int index) const;
    void setVertex(int index, std::array<double, 3> vertex);
    std::string info() const;

private:
    std::array<std::array<double, 3>, 3> vertices_;
};