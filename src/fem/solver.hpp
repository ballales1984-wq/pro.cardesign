#pragma once

#include <vector>
#include "stiffness.hpp"

class FemSolver {
public:
    FemSolver(const StiffnessMatrix& stiffnessMatrix);
    ~FemSolver() = default;

    std::vector<double> solve(const std::vector<double>& forceVector) const;

private:
    const StiffnessMatrix& stiffnessMatrix_;
    // In a real solver, we would factorize the matrix here (e.g., LU, Cholesky)
    // For simplicity, we assume the matrix is already invertible and we use a placeholder.
    // Note: This is a simplified example. A real FEM solver would be more complex.
};