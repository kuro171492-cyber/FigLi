import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => ({
  plugins: [react()],
  root: '.',
  // Local dev should run from "/", while production build keeps GitHub Pages base path.
  base: command === 'serve' ? '/' : '/kuro171492-cyber/FigLi/',
  build: {
    outDir: 'dist',
  },
}));
