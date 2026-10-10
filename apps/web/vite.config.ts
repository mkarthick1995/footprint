import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    // Dev: forward API calls to the local Cloud Run service (npm run dev:api).
    proxy: { '/api': 'http://localhost:8080' },
  },
  build: { outDir: 'dist', sourcemap: true },
});
