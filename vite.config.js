import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'
import { sentryVitePlugin } from '@sentry/vite-plugin'
import { fileURLToPath, URL } from 'node:url'
import process from 'node:process'
import pkg from './package.json';

// Source maps Sentry : générées et envoyées UNIQUEMENT quand le jeton est présent
// (build Vercel de prod), puis supprimées de dist/ pour ne pas publier le code
// source. Sans jeton (dev, CI, build local), rien ne change.
const sentryUpload = Boolean(process.env.SENTRY_AUTH_TOKEN)

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      // Manifest fourni en statique (public/manifest.webmanifest) : le plugin ne
      // gère que le service worker de cache.
      manifest: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png', 'pwa-192.png', 'pwa-512.png', 'pwa-maskable-512.png', 'manifest.webmanifest', 'fonts/TwemojiCountryFlags.woff2'],
      workbox: {
        // Cache JS/CSS/HTML app shell (+ icônes PWA, manifest & police drapeaux)
        globPatterns: ['**/*.{js,css,html,svg,ico,png,woff2,webmanifest}'],
        // pdfjs (chunk + worker) n'est chargé qu'à la demande, pour l'import PDF qui
        // exige d'être en ligne : inutile de l'imposer au précache de tous (~330 Kio).
        globIgnores: ['**/pdf-*.js', '**/pdf.worker*.mjs'],
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
    // Toujours en dernier : il lit les bundles finaux.
    sentryUpload && sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: `cardamome@${pkg.version}` },
      sourcemaps: { filesToDeleteAfterUpload: ['./dist/**/*.map'] },
      telemetry: false,
    }),
  ].filter(Boolean),
  resolve: {
    // Alias racine `@/` → `src/` : imports stables et lisibles, insensibles aux
    // déplacements de fichiers (hérité par Vitest via la config Vite).
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  define: {
    __APP_VERSION__: JSON.stringify(pkg.version),
  },
  appType: 'spa',
  build: {
    sourcemap: sentryUpload ? 'hidden' : false,
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
