# Test Suite — pro.cardesign

## Esecuzione Rapida

```bash
# Tutti i test Python
python -m pytest tests/test_coverage.py -v

# Con coverage report HTML
python -m pytest tests/test_coverage.py --cov=core --cov-report=html

# Solo test JavaScript
node tests/test_coverage.js
```

## Struttura Test

```
tests/
├── test_coverage.py          # 43 test Python (pytest)
├── test_coverage.js          # 4 test JavaScript (Node assert)
├── test_coverage_mocks.js    # Mock moduli per test JS
├── COVERAGE_REPORT.md        # Report coverage generato
└── README.md                 # Questo file
```

## Aggiungere un Test Python

1. Crea una classe che estende `unittest.TestCase`
2. Usa `setUp()` per inizializzare dati comuni
3. Usa `assertX()` per le verifiche
4. Esegui: `python -m pytest tests/test_coverage.py -v`

Esempio:
```python
class TestMioModulo(unittest.TestCase):
    def setUp(self):
        self.engine = VoxelEngine(16, 16, 16)
    
    def test_mia_funzione(self):
        result = self.engine.calculate_mass()
        self.assertGreater(result, 0)
```

## Aggiungere un Test JavaScript

1. Aggiungi una funzione async `testMiaFeature()` in `test_coverage.js`
2. Usa `assert.strictEqual()` o `assert.ok()`
3. Aggiungi il blocco try/catch nel `runAll()`

## Coverage Targets

| Modulo | Target | Attuale |
|--------|--------|---------|
| `core/brick.py` | 95% | 100% ✅ |
| `core/component.py` | 80% | 86% ✅ |
| `src/voxel-engine.js` | 60% | — |
| `src/material-system.js` | 80% | strutturale ✅ |

## Note

- I test Python usano `pytest` + `pytest-cop` (installato di default)
- I test JS usano Node.js nativo (no dipendenze esterne per test semplici)
- Mock globali in `tests/test_coverage_mocks.js` per isolare moduli