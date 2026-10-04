import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/uploads': {
        target: 'http://127.0.0.1:5000',
        changeOrigin: true,
      },
      '/socket.io': {
        target: 'http://127.0.0.1:5000',
        ws: true,
        changeOrigin: true,
        configure: (proxy) => {
          proxy.on('error', (err) => {
            if (
              err.code === 'ECONNABORTED' ||
              err.code === 'ECONNRESET' ||
              err.code === 'ECONNREFUSED' ||
              err.code === 'EPIPE' ||
              err.name === 'AggregateError'
            ) {
              return;
            }
            console.error('[vite] socket proxy error:', err);
          });
        },
      },
    },
  },
})
