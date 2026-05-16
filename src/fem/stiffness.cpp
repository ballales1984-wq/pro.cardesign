#include "stiffness.hpp"
#include <stdexcept>

StiffnessMatrix::StiffnessMatrix(int size)
    : size_(size), data_(size * size, 0.0) {}

void StiffnessMatrix::setValue(int row, int col, double value) {
    if (row < 0 || row >= size_ || col < 0 || col >= size_) {
        throw std::out_of_range("Index out of range");
    }
    data_[row * size_ + col] = value;
}

double StiffnessMatrix::getValue(int row, int col) const {
    if (row < 0 || row >= size_ || col < 0 || col >= size_) {
        throw std::out_of_range("Index out of range");
    }
    return data_[row * size_ + col];
}

std::vector<double> StiffnessMatrix::multiply(const std::vector<double>& vector) const {
    if (vector.size() != static_cast<size_t>(size_)) {
        throw std::invalid_argument("Vector size mismatch");
    }
    std::vector<double> result(size_, 0.0);
    for (int i = 0; i < size_; ++i) {
        for (int j = 0; j < size_; ++j) {
            result[i] += data_[i * size_ + j] * vector[j];
        }
    }
    return result;
}