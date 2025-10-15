import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    basicSsl()
  ],
  build: {
    outDir: 'front-end/static/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        register: 'front-end/src/register.js',
        auth: 'front-end/src/auth.js',
        index: 'front-end/src/index.js',
        'session-manager': 'front-end/src/session-manager.js'
      },
      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name].[ext]'
      }
    }
  },
  server: {
    https: true,
    proxy: {
      '/api': {
        target: 'http://localhost:5000',  // Changed from 3000 to 5001 to match Flask's port
        changeOrigin: true,
        secure: false
      }
    }
  }
});
