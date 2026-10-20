/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { execSync } from 'node:child_process'

function appVersion(): string {
  if (process.env.APP_VERSION) return process.env.APP_VERSION
  try {
    return execSync('git describe --tags --always --dirty', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim()
  } catch {
    return 'dev'
  }
}

export default defineConfig({
  plugins: [
    svelte(),
    VitePWA({
      // The app shows its own "update available" toast (src/lib/ui/pwa.ts).
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['theme.js', 'icons/apple-touch-icon.png', 'icons/favicon-32.png'],
      manifest: {
        name: 'Write-Hand',
        short_name: 'Write-Hand',
        description: 'Draw your handwriting and download it as a font. Everything stays on your device.',
        id: '/',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        theme_color: '#c0caf5',
        background_color: '#c0caf5',
        categories: ['design', 'productivity', 'utilities'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/maskable-192.png', sizes: '192x192', type: 'image/png', purpose: 'maskable' },
          { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache everything, including the lazy HarfBuzz wasm and the build
        // worker, so the whole app works offline after the first visit.
        globPatterns: ['**/*.{js,css,html,woff2,wasm,png,ttf,webmanifest}'],
        maximumFileSizeToCacheInBytes: 3 * 1024 * 1024,
        navigateFallback: '/index.html',
        cleanupOutdatedCaches: true,
      },
      devOptions: { enabled: false },
    }),
  ],
  define: {
    __APP_VERSION__: JSON.stringify(appVersion()),
  },
  worker: { format: 'es' },
  // harfbuzzjs finds its wasm via new URL('harfbuzz.wasm', import.meta.url),
  // which dev pre-bundling would break.
  // The dep scanner doesn't follow `new Worker(new URL(...))` or lazy imports,
  // so pre-bundle those deps up front; otherwise the dev server discovers them
  // mid-session and force-reloads the page.
  optimizeDeps: { exclude: ['harfbuzzjs'], include: ['woff2-encoder', 'clipper2-ts', 'opentype.js', 'perfect-freehand'] },
  build: {
    target: 'es2022',
    // Only index.html is an entry: lab/ is dev-only and never ships.
    rollupOptions: { input: 'index.html' },
  },
  test: {
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    environment: 'node',
    testTimeout: 30_000,
  },
})
