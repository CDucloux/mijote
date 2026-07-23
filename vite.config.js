import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import pkg from './package.json';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Manifest fourni en statique (public/manifest.webmanifest) : le plugin ne
      // gère que le service worker de cache.
      manifest: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png', 'pwa-maskable-512.png', 'manifest.webmanifest'],
      workbox: {
        // Cache JS/CSS/HTML app shell (+ icônes PWA & manifest)
        globPatterns: ['**/*.{js,css,html,svg,ico,png,webmanifest}'],
        // Toute navigation hors ligne (y compris /profile, /config…) sert le shell.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
        runtimeCaching: [
          {
            // Images from Firebase Storage and any other origin
            urlPattern: /\.(?:png|jpg|jpeg|gif|webp|svg|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mijote-images',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 90, // 90 days
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
          {
            // Firebase Storage URLs (firebasestorage.googleapis.com)
            urlPattern: /^https:\/\/firebasestorage\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'mijote-firebase-images',
              expiration: {
                maxEntries: 500,
                maxAgeSeconds: 60 * 60 * 24 * 90,
              },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  appType: 'spa',
  build: {
    rollupOptions: {
      output: {
        // Sépare les dépendances stables dans leurs propres chunks : elles ne
        // bougent quasiment jamais → mises en cache durablement par le
        // navigateur, seul le code applicatif est re-téléchargé à chaque deploy.
        manualChunks(id) {
          if (id.includes('node_modules/firebase') || id.includes('node_modules/@firebase')) return 'firebase';
          if (/node_modules\/(react|react-dom|react-router|react-router-dom|scheduler)\//.test(id)) return 'react';
        },
      },
    },
  },
});
