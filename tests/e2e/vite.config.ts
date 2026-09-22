import { defineConfig, mergeConfig } from 'vite';
import base from '../../vite.config';

// Isolate browser tests from a developer's running app and exercise the real
// production service worker, while HTTP test auth uses development cookies.
export default mergeConfig(
  base,
  defineConfig({
    build: { outDir: 'dist-e2e' },
    preview: { strictPort: true, proxy: { '/api': 'http://127.0.0.1:3002' } },
  }),
);
