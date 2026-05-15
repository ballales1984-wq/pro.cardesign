# Test Suite — pro.cardesign

## Quick Execution

```bash
# All Python tests
python -m pytest tests/test_coverage.py -v

# With HTML coverage report
python -m pytest tests/test_coverage.py --cov=core --cov-report=html

# JavaScript tests only
node tests/test_coverage.js
```

## Test Structure

```
tests/
├── test_coverage.py          # 43 Python tests (pytest)
├── test_coverage.js          # 4 JavaScript tests (Node assert)
├── test_coverage_mocks.js    # Mock modules for JS tests
├── COVERAGE_REPORT.md        # Generated coverage report
└── README.md                 # This file
```

## Adding a Python Test

1. Create a class that extends `unittest.TestCase`
2. Use `setUp()` to initialize common data
3. Use `assertX()` for verifications
4. Run: `python -m pytest tests/test_coverage.py -v`

Example:
```python
class TestMyModule(unittest.TestCase):
    def setUp(self):
        self.engine = VoxelEngine(16, 16, 16)
    
    def test_my_function(self):
        result = self.engine.calculate_mass()
        self.assertGreater(result, 0)
```

## Adding a JavaScript Test

1. Add an async function `testMyFeature()` in `test_coverage.js`
2. Use `assert.strictEqual()` or `assert.ok()`
3. Add the try/catch block in `runAll()`

## Coverage Targets

| Module | Target | Current |
|--------|--------|---------|
| `core/brick.py` | 95% | 100% ✅ |
| `core/component.py` | 80% | 86% ✅ |
| `src/voxel-engine.js` | 60% | — |
| `src/material-system.js` | 80% | structural ✅ |

## Notes

- Python tests use `pytest` + `pytest-cop` (installed by default)
- JS tests use Node.js native (no external dependencies for simple tests)
- Global mocks in `tests/test_coverage_mocks.js` to isolate modules