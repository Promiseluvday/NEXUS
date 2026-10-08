// Build settings for the Nexus screens.
//   * react():   lets Vite understand React screen files (.tsx)
//   * VitePWA(): makes the app installable on a phone or tablet and keeps a
//                copy of the screens on the device so it opens with no signal.
//                (Saving DATA offline is Phase 1C.)
/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png'],
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'], // fonts too, for no-signal use
        navigateFallback: 'index.html',                   // any screen address opens offline
      },
      manifest: {
        name: 'Nexus MRO',
        short_name: 'Nexus',
        description: 'Aircraft maintenance and operations records',
        theme_color: '#000000',
        background_color: '#dcecf8',
        display: 'standalone',
        icons: [
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any' },
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    host: true, // also reachable from a phone on the same Wi-Fi, for testing
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
