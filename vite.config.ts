/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { fileURLToPath, URL } from 'node:url';

export default defineConfig({
  // Relative base so the build works from any static host or sub-path (e.g. a home server folder).
  base: './',
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@content': fileURLToPath(new URL('./content', import.meta.url)),
    },
  },
  plugins: [
    react(),
    VitePWA({
      // New versions install and take over by themselves (there is no update prompt).
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Smart English Tutor',
        short_name: 'English',
        description: 'מורה אישי לאנגלית',
        lang: 'he',
        dir: 'rtl',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f7f6ff',
        theme_color: '#5b3df5',
        start_url: './',
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' }],
      },
      workbox: {
        // Audio is not precached (thousands of files). It is cached on first
        // use, or all at once from the parent screen ("download audio").
        globPatterns: ['**/*.{js,css,html,svg,json,woff2}'],
        // The reading-check model is large and optional. transformers.js keeps it
        // in its own cache on first use; the service worker leaves it alone.
        globIgnores: ['models/**', 'ort/**', '**/*.wasm'],
        // The app bundle includes all content (~2.5 MB, ~0.5 MB compressed); it must be precached for offline use.
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
        navigateFallback: 'index.html',
        skipWaiting: true,
        clientsClaim: true,
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.includes('/audio/') && url.pathname.endsWith('.mp3'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'audio-v1',
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 10000 },
            },
          },
        ],
      },
    }),
  ],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    include: ['src/**/*.test.{ts,tsx}', 'content/**/*.test.ts', 'tests/**/*.test.{ts,tsx}', 'tools/**/*.test.ts'],
  },
});
