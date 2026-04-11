import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] })
  ],
  server: {
    proxy: {
      // Same-origin /api in dev → Flask (avoids CORS; set VITE_API_BASE_URL to override).
      '/api': { target: 'http://127.0.0.1:5001', changeOrigin: true },
    },
  },
})
