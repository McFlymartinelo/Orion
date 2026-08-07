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
        orientation: 'landscape',
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
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
            handler: 'NetworkOnly',
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
