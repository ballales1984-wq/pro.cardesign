import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  // Relative paths so Electron loadFile(dist/index.html) resolves assets correctly
  base: './',

  server: {
    port: 5176,
    strictPort: true,
    host: '0.0.0.0',
    open: '/index.html',
    fs: {
      // Do not serve the Electron main process file as a web module
      deny: ['electron-main.js', 'preload.js'],
    },
  },

  build: {

    target: 'esnext'

  },

  resolve: {
    alias: {
      'three': path.resolve(__dirname, 'node_modules/three'),
    },
  },

  esbuild: {

    target: 'esnext'

  }

});
