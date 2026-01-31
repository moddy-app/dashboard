import { defineConfig } from 'vite';

export default defineConfig({
  envPrefix: 'A_',
  build: {
    outDir: 'dist',
    sourcemap: true,
  },
});
