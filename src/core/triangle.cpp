#include "triangle.hpp"
#include <sstream>
#include <cmath>

Triangle::Triangle(std::array<double, 3> v1, std::array<double, 3> v2, std::array<double, 3> v3)
    : vertices_{v1, v2, v3} {}

std::array<double, 3> Triangle::getVertex(int index) const {
    if (index < 0 || index >= 3) {
        throw std::out_of_range("Vertex index out of range");
    }
    return vertices_[index];
}

void Triangle::setVertex(int index, std::array<double, 3> vertex) {
    if (index < 0 || index >= 3) {
        throw std::out_of_range("Vertex index out of range");
    }
    vertices_[index] = vertex;
}

std::string Triangle::info() const {
    std::ostringstream oss;
    oss << "Triangle[v0: (" << vertices_[0][0] << ", " << vertices_[0][1] << ", " << vertices_[0][2] << "), "
        << "v1: (" << vertices_[1][0] << ", " << vertices_[1][1] << ", " << vertices_[1][2] << "), "
        << "v2: (" << vertices_[2][0] << ", " << vertices_[2][1] << ", " << vertices_[2][2] << ")]";
    return oss.str();
}