// `defineConfig` comes from vitest/config, not vite, so the `test` block is
// typed. Vitest re-exports Vite's own config type, so nothing else changes.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // Relative asset paths so the build works from any sub-path:
  // GitHub Pages project sites, Netlify, Cloudflare Pages, or a plain file server.
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
  },
});
