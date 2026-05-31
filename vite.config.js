import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({
  base: './',

  server: {
    port: 5176,
    strictPort: true,
    host: '0.0.0.0',
  },

  build: {
    target: 'esnext',
    outDir: 'dist',
    emptyOutDir: true,
    // Use esbuild instead of rollup to avoid native binding issues
    minify: false,
  },

  resolve: {
    alias: {
      'three': path.resolve(__dirname, 'node_modules/three'),
    },
  },

});
