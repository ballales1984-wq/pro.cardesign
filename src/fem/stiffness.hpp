#pragma once

#include <vector>
#include <array>

class StiffnessMatrix {
public:
    StiffnessMatrix(int size);
    ~StiffnessMatrix() = default;

    void setValue(int row, int col, double value);
    double getValue(int row, int col) const;
    std::vector<double> multiply(const std::vector<double>& vector) const;

private:
    int size_;
    std::vector<double> data_; // stored in row-major order
};