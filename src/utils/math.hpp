#pragma once

#include <array>
#include <cmath>

namespace utils {
    // Simple 3D vector operations
    template<typename T>
    std::array<T, 3> cross(const std::array<T, 3>& a, const std::array<T, 3>& b) {
        return {
            a[1] * b[2] - a[2] * b[1],
            a[2] * b[0] - a[0] * b[2],
            a[0] * b[1] - a[1] * b[0]
        };
    }

    template<typename T>
    T dot(const std::array<T, 3>& a, const std::array<T, 3>& b) {
        return a[0]*b[0] + a[1]*b[1] + a[2]*b[2];
    }

    template<typename T>
    T length(const std::array<T, 3>& v) {
        return std::sqrt(dot(v, v));
    }

    template<typename T>
    std::array<T, 3> normalize(const std::array<T, 3>& v) {
        T len = length(v);
        if (len == 0) return v;
        return {v[0]/len, v[1]/len, v[2]/len};
    }
}