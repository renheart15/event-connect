import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  build: {
    outDir: "dist",
    assetsDir: "assets",
    sourcemap: false,
    rollupOptions: {
      external: [
        '@capacitor/app',
        '@capacitor/core',
        '@capacitor/camera',
        '@capacitor/geolocation',
        '@capacitor/haptics',
        '@capacitor/local-notifications',
        '@capacitor/splash-screen',
        '@capacitor/status-bar',
        '@capacitor-mlkit/barcode-scanning'
      ],
      output: {
        manualChunks: undefined,
        entryFileNames: `assets/[name]-[hash].js`,
        chunkFileNames: `assets/[name]-[hash].js`,
        assetFileNames: `assets/[name]-[hash].[ext]`,
        globals: {
          '@capacitor/app': 'capacitorApp',
          '@capacitor/core': 'capacitorCore',
          '@capacitor/camera': 'capacitorCamera',
          '@capacitor/geolocation': 'capacitorGeolocation',
          '@capacitor/haptics': 'capacitorHaptics',
          '@capacitor/local-notifications': 'capacitorLocalNotifications',
          '@capacitor/splash-screen': 'capacitorSplashScreen',
          '@capacitor/status-bar': 'capacitorStatusBar',
          '@capacitor-mlkit/barcode-scanning': 'capacitorBarcodeScanning'
        }
      },
    },
  },
  server: {
    host: "::",
    port: 8080,
    strictPort: true,
    historyApiFallback: true,
    proxy: {
      // Proxy API calls to backend server
      "/api": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
        configure: (proxy, options) => {
          proxy.on('error', (err, req, res) => {
            console.log('Proxy error:', err);
          });
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('Proxying request:', req.method, req.url);
          });
        },
      },
    },
    allowedHosts: [
      ".ngrok-free.app", // ✅ allow any ngrok subdomain (keeping for backward compatibility)
      ".trycloudflare.com", // ✅ allow any cloudflare tunnel subdomain
    ],
  },
  plugins: [
    react(),
    mode === "development" && componentTagger(),
    VitePWA({
      registerType: 'prompt',
      includeAssets: ['favicon.png', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'Event Connect Mobile',
        short_name: 'Event Connect',
        description: 'Scan & Join Events - Mobile Event Management App',
        start_url: '/participant-dashboard',
        display: 'standalone',
        background_color: '#4C1D95',
        theme_color: '#4C1D95',
        orientation: 'portrait',
        icons: [
          {
            src: '/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/api\..*/i,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'api-cache',
              expiration: {
                maxEntries: 50,
                maxAgeSeconds: 5 * 60, // 5 minutes
              },
              cacheableResponse: {
                statuses: [0, 200]
              }
            }
          },
          {
            urlPattern: /\.(png|jpg|jpeg|svg|gif|webp)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'image-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 30 * 24 * 60 * 60, // 30 days
              }
            }
          }
        ],
        cleanupOutdatedCaches: true,
        skipWaiting: false,
        clientsClaim: false
      },
      devOptions: {
        enabled: false,
        type: 'module'
      }
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
