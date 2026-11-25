import { defineConfig } from 'vite';

export default defineConfig({
  // Относительные пути, чтобы собранную версию (dist) можно было положить в любую подпапку сайта.
  base: './',
  server: {
    port: 5180,
    strictPort: false,
  },
  build: {
    chunkSizeWarningLimit: 1200,
  },
});
