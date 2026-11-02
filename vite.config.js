import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import basicSsl from '@vitejs/plugin-basic-ssl'
import { VitePWA } from 'vite-plugin-pwa'

const NETATMO_PROXY_PORT = process.env.NETATMO_PROXY_PORT || 4000

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    // HTTPS local : requis pour une vraie installation PWA (plein écran) sur Android
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/icon-180.png'],
      manifest: {
        name: 'Orion · Home Control',
        short_name: 'Orion',
        description: 'Tableau de bord domotique Orion',
        theme_color: '#050608',
        background_color: '#050608',
        display: 'fullscreen',
        display_override: ['fullscreen', 'standalone'],
        // Laisse le téléphone en portrait (la mise en page s'adapte) et la tablette
        // en paysage, sans forcer la rotation.
        orientation: 'any',
        start_url: '/',
        scope: '/',
        lang: 'fr',
        icons: [
          {
            src: 'icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: 'icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
      },
      workbox: {
        // Ne pas mettre en cache les appels API (toujours frais)
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api\//, /^\/models\//],
        globIgnores: ['**/models/**'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
          },
          {
            // GLB compressé (~7 Mo) : cache-first pour que la 3D marche hors-ligne.
            // Pas de precache (globIgnores) : on ne veut pas embarquer les 95 Mo
            // d'export Sweet Home 3D (.obj/.mtl/textures) encore présents.
            // ⚠ Incrémenter le nom du cache (v1 → v2) à chaque nouvel export du GLB,
            // sinon l'ancien modèle reste servi indéfiniment.
            urlPattern: ({ url }) => url.pathname.startsWith('/models/'),
            handler: 'CacheFirst',
            options: {
              cacheName: 'orion-models-v1',
              expiration: { maxEntries: 8, maxAgeSeconds: 60 * 60 * 24 * 30 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
      // Permet d'installer la PWA aussi en mode dev (tablette sur le LAN)
      devOptions: {
        enabled: true,
        navigateFallback: 'index.html',
      },
    }),
  ],
  server: {
    // Accessible depuis la tablette / autres appareils du LAN (pas seulement localhost)
    host: true,
    port: 5173,
    strictPort: false,
    https: true,
    // Export brut Sweet Home 3D (88 Mo) : hors build, et hors watcher (EBUSY).
    watch: {
      ignored: ['**/model-source/**'],
    },
    proxy: {
      // Redirige les appels /api/* du frontend vers le petit serveur Express
      // (server/index.js) qui gère l'authentification Netatmo côté serveur.
      '/api': {
        target: `http://localhost:${NETATMO_PROXY_PORT}`,
        changeOrigin: true,
      },
    },
  },
})
