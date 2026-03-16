import { defineConfig } from 'vite';

export default defineConfig(({ mode }) => ({
  root: '.',
  base: '/caseGenerator/',
  build: {
    outDir: 'dist',
  },
}));
