import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ command }) => {
  const repoName = process.env.GITHUB_REPOSITORY?.split('/')[1];

  return {
    plugins: [react()],
    root: '.',
    // For GitHub Pages project sites use "/<repo>/".
    base: command === 'serve' ? '/' : repoName ? `/${repoName}/` : '/FigLi_G/',
    build: {
      outDir: 'dist',
    },
  };
});
