#define PY_SSIZE_T_CLEAN
#include <Python.h>
#include <cmath>

static PyObject* py_stress_analysis(PyObject* self, PyObject* args) {
    PyObject* pos_list, *dens_list, *force_tuple, *com_tuple;
    if (!PyArg_ParseTuple(args, "OOOO", &pos_list, &dens_list, &force_tuple, &com_tuple)) return NULL;
    Py_ssize_t n = PyList_Size(pos_list);
    double fx, fy, fz, com_x, com_y, com_z;
    PyObject* item = PyTuple_GetItem(force_tuple, 0); fx = PyFloat_AsDouble(item);
    item = PyTuple_GetItem(force_tuple, 1); fy = PyFloat_AsDouble(item);
    item = PyTuple_GetItem(force_tuple, 2); fz = PyFloat_AsDouble(item);
    item = PyTuple_GetItem(com_tuple, 0); com_x = PyFloat_AsDouble(item);
    item = PyTuple_GetItem(com_tuple, 1); com_y = PyFloat_AsDouble(item);
    item = PyTuple_GetItem(com_tuple, 2); com_z = PyFloat_AsDouble(item);
    PyObject* result = PyList_New(n);
    for (Py_ssize_t i = 0; i < n; i++) {
        PyObject* pos_item = PyList_GetItem(pos_list, i);
        PyObject* pos_tuple = PyTuple_GetItem(pos_item, 0);
        double px = PyFloat_AsDouble(PyTuple_GetItem(pos_tuple, 0));
        double py = PyFloat_AsDouble(PyTuple_GetItem(pos_tuple, 1));
        double pz = PyFloat_AsDouble(PyTuple_GetItem(pos_tuple, 2));
        PyObject* dens_item = PyList_GetItem(dens_list, i);
        double dens = PyFloat_AsDouble(dens_item);
        double dx = px - com_x, dy = py - com_y, dz = pz - com_z;
        double dist_sq = dx*dx + dy*dy + dz*dz;
        double dist = dist_sq > 1.0 ? sqrt(dist_sq) : 1.0;
        double stress = dens * fabs(fz) / dist;
        PyList_SetItem(result, i, PyFloat_FromDouble(stress));
    }
    PyObject* dict = PyDict_New();
    PyDict_SetItemString(dict, "stress", result);
    return dict;
}

static PyObject* py_calculate_mass(PyObject* self, PyObject* args) {
    PyObject* bricks_list; if (!PyArg_ParseTuple(args, "O", &bricks_list)) return NULL;
    Py_ssize_t n = PyList_Size(bricks_list); double total = 0.0;
    for (Py_ssize_t i = 0; i < n; i++) {
        PyObject* brick = PyList_GetItem(bricks_list, i);
        double vol = PyFloat_AsDouble(PyDict_GetItemString(brick, "width")) *
                     PyFloat_AsDouble(PyDict_GetItemString(brick, "height")) *
                     PyFloat_AsDouble(PyDict_GetItemString(brick, "depth"));
        total += vol * PyFloat_AsDouble(PyDict_GetItemString(brick, "density")) / 1000000.0;
    }
    return PyFloat_FromDouble(total);
}

static PyObject* py_calculate_com(PyObject* self, PyObject* args) {
    PyObject* bricks_list; if (!PyArg_ParseTuple(args, "O", &bricks_list)) return NULL;
    Py_ssize_t n = PyList_Size(bricks_list); double total_mass = 0, wx = 0, wy = 0, wz = 0;
    for (Py_ssize_t i = 0; i < n; i++) {
        PyObject* brick = PyList_GetItem(bricks_list, i);
        double x = PyFloat_AsDouble(PyDict_GetItemString(brick, "x"));
        double y = PyFloat_AsDouble(PyDict_GetItemString(brick, "y"));
        double z = PyFloat_AsDouble(PyDict_GetItemString(brick, "z"));
        double w = PyFloat_AsDouble(PyDict_GetItemString(brick, "width"));
        double h = PyFloat_AsDouble(PyDict_GetItemString(brick, "height"));
        double d = PyFloat_AsDouble(PyDict_GetItemString(brick, "depth"));
        double dens = PyFloat_AsDouble(PyDict_GetItemString(brick, "density"));
        double mass = w * h * d * dens / 1000000.0;
        total_mass += mass; wx += mass * (x + w/2); wy += mass * (y + h/2); wz += mass * (z + d/2);
    }
    PyObject* result = PyTuple_New(3);
    PyTuple_SetItem(result, 0, PyFloat_FromDouble(total_mass == 0 ? 0 : wx / total_mass));
    PyTuple_SetItem(result, 1, PyFloat_FromDouble(total_mass == 0 ? 0 : wy / total_mass));
    PyTuple_SetItem(result, 2, PyFloat_FromDouble(total_mass == 0 ? 0 : wz / total_mass));
    return result;
}

static PyMethodDef PhysicsMethods[] = {
    {"stress_analysis", py_stress_analysis, METH_VARARGS, "Calculate stress"},
    {"calculate_mass", py_calculate_mass, METH_VARARGS, "Calculate mass"},
    {"calculate_com", py_calculate_com, METH_VARARGS, "Calculate COM"},
    {NULL, NULL, 0, NULL}
};

static struct PyModuleDef physicsmodule = {PyModuleDef_HEAD_INIT, "physics_c_api", "Physics C API", -1, PhysicsMethods};
PyMODINIT_FUNC PyInit_physics_c_api(void) { return PyModule_Create(&physicsmodule); }
