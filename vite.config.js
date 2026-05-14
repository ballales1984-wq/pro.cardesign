import { defineConfig } from 'vite';

export default defineConfig({
  root: '.',
  publicDir: 'public',
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      external: ['three'],
      output: {
        globals: {
          three: 'THREE',
        },
      },
    },
  },
  resolve: {
    alias: {
      'three': 'three/src/Three.js',
    },
  },
  server: {
    port: 5173,
    strictPort: true,
  },
});