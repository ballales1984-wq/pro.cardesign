import { defineConfig } from 'vite';
import path from 'path';

export default defineConfig({

  server: {

    port: 5176,

    host: '0.0.0.0'

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
