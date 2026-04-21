import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  root: '.',
  base: '/kuro171492-cyber/FigLi/',
  build: {
    outDir: 'dist',
  },
});
