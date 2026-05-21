import { defineConfig } from 'vite';

export default defineConfig({

  server: {

    port: 5176,

    host: '0.0.0.0'

  },

  build: {

    target: 'esnext'

  },

  esbuild: {

    target: 'esnext'

  }

});
