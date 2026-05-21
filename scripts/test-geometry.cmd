# test geometry tests runner
echo "=== Geometry Run (coverage in test_coverage.js already handles this) ==="
npx --yes jest tests/geometry/OptimizedBoolean.test.js tests/geometry/Decimator.test.js --no-coverage --forceExit 2>&1 | findstr "PASS|FAIL|Tests:"
