#include <pybind11/pybind11.h>
#include <pybind11/stl.h>

#include "../core/voxel.hpp"
#include "../core/material.hpp"
#include "../core/triangle.hpp"
#include "../fem/solver.hpp"

namespace py = pybind11;

PYBIND11_MODULE(voxelengine, m) {
    m.doc() = "Motore voxel-triangoli con FEM";

    py::class_<Voxel>(m, "Voxel")
        .def(py::init<int,int,int>())
        .def("set_material", &Voxel::setMaterial)
        .def("get_material_id", &Voxel::getMaterialId)
        .def("get_position", &Voxel::getPosition)
        .def("info", &Voxel::info);

    py::class_<Material>(m, "Material")
        .def(py::init<float,float>())
        .def("density", &Material::density)
        .def("young_modulus", &Material::youngModulus)
        .def("info", &Material::info);

    py::class_<Triangle>(m, "Triangle")
        .def(py::init<std::array<double,3>, std::array<double,3>, std::array<double,3>>())
        .def("get_vertex", &Triangle::getVertex)
        .def("set_vertex", &Triangle::setVertex)
        .def("info", &Triangle::info);

    // Expose FEM solver (simplified)
    py::class_<FemSolver>(m, "FemSolver")
        .def(py::init<const StiffnessMatrix&>())
        .def("solve", &FemSolver::solve);

    // For completeness, expose StiffnessMatrix (though in practice you might not expose it directly)
    py::class_<StiffnessMatrix>(m, "StiffnessMatrix")
        .def(py::init<int>())
        .def("set_value", &StiffnessMatrix::setValue)
        .def("get_value", &StiffnessMatrix::getValue)
        .def("multiply", &StiffnessMatrix::multiply);
}