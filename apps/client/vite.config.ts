import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
      // @riftborn/shared resolved through node_modules (pnpm workspace symlink → dist/index.js)
      // Vite pre-bundles it via optimizeDeps, converting CJS→ESM correctly
    },
  },
  optimizeDeps: {
    include: ['@riftborn/shared'],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
    },
  },
  build: {
    target: 'esnext',
    rollupOptions: {
      output: {
        manualChunks: {
          pixi: ['pixi.js'],
          vendor: ['react', 'react-dom', 'react-router-dom'],
        },
      },
    },
  },
});
