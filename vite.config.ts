// vite.config.ts
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// JST の日時を YYYY-MM-DD HH:mm 形式で生成
const now = new Date();
const jstParts = new Intl.DateTimeFormat('ja-JP', {
  timeZone: 'Asia/Tokyo',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false
}).formatToParts(now);

const getPart = (type: string) => jstParts.find(p => p.type === type)?.value || '';
const buildDate = `${getPart('year')}-${getPart('month')}-${getPart('day')} ${getPart('hour')}:${getPart('minute')} JST`;

export default defineConfig({
  base: './',
  plugins: [
    react(),
    tailwindcss(),
// vite.config.ts の VitePWA 部分を修正
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.ico', 'audio-recorder-worklet.js', 'pwa-192x192.svg', 'pwa-512x512.svg'],
      manifest: {
        name: 'カラオケ練習マシン',
        short_name: 'カラオケマシン',
        description: '超低遅延・高音質ピュア録音＆リップシンク微調整つきカラオケ練習マシン',
        theme_color: '#020617',
        background_color: '#020617',
        display: 'standalone',
        orientation: 'portrait',
        start_url: './', // ★必須: サブディレクトリ対応
        scope: './',     // ★必須: サブディレクトリ対応
        icons: [
          {
            src: 'pwa-192x192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
          {
            src: 'pwa-512x512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,wasm}'],
      },
    }),
  ],
  define: {
    __BUILD_DATE__: JSON.stringify(buildDate),
  },
})
