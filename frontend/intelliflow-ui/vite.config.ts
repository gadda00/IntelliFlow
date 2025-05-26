import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Add this to ensure proper environment for Netlify
    target: 'es2015',
    // Add this to prevent minification issues
    minify: 'terser',
    terserOptions: {
      compress: {
        // Add this to prevent null reference errors
        keep_fnames: true,
        keep_classnames: true
      }
    }
  }
})
