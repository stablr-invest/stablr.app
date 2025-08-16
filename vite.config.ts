import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    exclude: ['lucide-react'],
    esbuildOptions: {
      define: {
        global: 'globalThis',
      },
    },
  },
  server: {
    proxy: {
      '/aave-graphql': {
        target: 'https://api.v3.aave.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/aave-graphql/, '/graphql'),
        secure: true,
      },
    },
  },
});