import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { padduWsPlugin } from './server/wsPlugin.js'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), padduWsPlugin()],
  server: {
    // Always allow network access so phones can reach the dev server
    host: true
  },
  preview: {
    allowedHosts: ['paddu-cart-ncwl.onrender.com']  // ✅ must match your Render domain exactly
  }
})
