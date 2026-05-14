# pro.cardesign Desktop Application

A desktop application for the pro.cardesign design system built with Electron.

## Features

- Cross-platform desktop application (Windows, macOS, Linux)
- Simple interface showcasing the design system
- Built with Electron for native desktop capabilities

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 14 or higher)
- npm (comes with Node.js)

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

### Development

To start the application in development mode:
```bash
npm run dev
```

### Packaging

To package the application for distribution:
```bash
npm run package
```

This will create platform-specific installers in the `dist/` directory.

## Project Structure

- `main.js` - Main Electron process
- `preload.js` - Preload script for secure communication between main and renderer processes
- `index.html` - Main application window
- `package.json` - Project metadata and dependencies

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.