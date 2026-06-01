# Contributing to pro.cardesign

Thank you for interest in contributing! This document provides guidelines for contributing to the project.

## Code of Conduct

- Be respectful and inclusive
- Focus on constructive feedback
- Help others learn and grow

## Getting Started

1. **Fork** the repository
2. **Clone** your fork locally
3. **Create** a feature branch (`git checkout -b feature/your-feature`)
4. **Make** your changes
5. **Test** thoroughly
6. **Commit** with clear messages
7. **Push** to your fork
8. **Create** a Pull Request

## Development Setup

### Python Environment

```bash
# Create virtual environment
python -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt
```

### JavaScript Environment

```bash
npm install
```

## Code Standards

### Python

- Follow [PEP 8](https://pep8.org/)
- Use `black` for formatting: `black core/`
- Use `isort` for imports: `isort core/`
- Type hints encouraged: `mypy core/`

```bash
# Format and check
black core/ tests/
isort core/ tests/
flake8 core/ tests/
mypy core/
```

### JavaScript

- Follow ESLint rules: `npm run lint`
- Use `const`/`let`, not `var`
- Single quotes for strings
- 2-space indentation

```bash
npm run lint:fix
```

## Testing

**Tests are mandatory for every change.**

### Run Python Tests

```bash
# All tests
python -m pytest tests/ -v

# With coverage
python -m pytest tests/ --cov=core --cov-report=html

# Specific test
python -m pytest tests/test_brick.py -v
```

### Run JavaScript Tests

```bash
# All tests
node tests/test_coverage.js

# Watch mode (if configured)
npm run test:watch
```

### Before Committing

```bash
# Python
python -m pytest tests/ --cov=core
black core/ tests/
flake8 core/ tests/

# JavaScript
npm run test:js
npm run lint
```

## Commit Messages

Use clear, descriptive messages following this format:

```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types

- **feat**: New feature
- **fix**: Bug fix
- **docs**: Documentation
- **style**: Code style (formatting, etc.)
- **refactor**: Code refactoring
- **perf**: Performance improvements
- **test**: Test additions/updates
- **chore**: Build, dependencies, etc.

### Examples

```
feat(brick-system): add overlap detection

Implement spatial overlap detection for brick collisions.
- Add BoundingBox class
- Implement AABB algorithm
- Add tests for edge cases

Closes #42
```

```
fix(scaling-tool): correct dimension calculation

The scaling tool was incorrectly calculating dimensions when scaling
from the right face. Changed from absolute to relative positioning.

Fixes #88
```

## Pull Request Process

1. **Title**: Clear, descriptive title
2. **Description**: 
   - What does it do?
   - Why is it needed?
   - How was it tested?
3. **Tests**: Include test cases or evidence of testing
4. **Documentation**: Update README/docs if needed
5. **Code Review**: Address feedback promptly

## Project Structure

**Keep the structure organized:**

```
core/           → Python logic (brick, components, physics)
src/            → JavaScript (UI, rendering, tools)
src/core/       → Shared core logic (brick-system, components)
tests/          → All tests (Python + JavaScript)
.github/        → CI/CD workflows
```

## File Naming

- **JavaScript**: `kebab-case.js` (e.g., `voxel-engine.js`)
- **Python**: `snake_case.py` (e.g., `brick_system.py`)

## Documentation

- Update README.md for major changes
- Add docstrings to functions
- Include code comments for complex logic
- Document new APIs in code

## Questions?

- Check [AGENTS.md](AGENTS.md) for AI guidelines
- Review [README.md](README.md) for architecture
- Look at existing tests for examples

---

**Thank you for contributing to pro.cardesign! 🚗**