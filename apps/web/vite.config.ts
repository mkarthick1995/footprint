import { fileURLToPath } from 'node:url';
import { defineConfig } from 'vite';

export default defineConfig({
  resolve: {
    // Use the shared package's source, not its compiled dist/, so edits show up without a rebuild (stale dist/ once
    // made clip runs silently test old code).
    alias: { '@footprint/shared': fileURLToPath(new URL('../../packages/shared/src/index.ts', import.meta.url)) },
  },
  server: {
    // Dev: forward API calls to the local Cloud Run service (npm run dev:api).
    proxy: { '/api': 'http://localhost:8080' },
  },
  build: { outDir: 'dist', sourcemap: true },
});
