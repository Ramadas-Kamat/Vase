// `defineConfig` comes from vitest/config, not vite, so the `test` block is
// typed. Vitest re-exports Vite's own config type, so nothing else changes.
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// This config runs in Node, but the project only ships browser type definitions.
// Declaring the one API used here avoids adding @types/node for three lines.
declare const process: { env: Record<string, string | undefined> };

// Vite lets real environment variables outrank `.env`, which is what makes the
// branding overridable per deployment. The catch is that a variable which is
// *defined but blank* wins too: an unset GitHub Actions `vars.VITE_APP_NAME`
// expands to "", which would silently blank the app name instead of falling
// back to the default. Treat blank as absent, before Vite reads the env.
for (const key of Object.keys(process.env)) {
  if (key.startsWith('VITE_') && !process.env[key]?.trim()) delete process.env[key];
}

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
