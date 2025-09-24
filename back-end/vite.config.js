import { defineConfig } from 'vite';
import basicSsl from '@vitejs/plugin-basic-ssl';

export default defineConfig({
  plugins: [
    basicSsl()
  ],
  build: {
    outDir: 'static/dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        register: 'src/register.js',
        auth: 'src/auth.js',
        totp: 'src/totp.js'
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
