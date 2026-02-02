import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  root: 'src/renderer',
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
      '@components': path.resolve(__dirname, 'src/renderer/components'),
      '@services': path.resolve(__dirname, 'src/renderer/services'),
      '@hooks': path.resolve(__dirname, 'src/renderer/hooks'),
      '@stores': path.resolve(__dirname, 'src/renderer/stores'),
      '@core': path.resolve(__dirname, 'src/core'),
    }
  },
  build: {
    outDir: '../../dist/renderer',
    emptyOutDir: true,
    sourcemap: process.env.NODE_ENV !== 'production',
    minify: 'terser',
    terserOptions: { compress: { drop_console: process.env.NODE_ENV === 'production', drop_debugger: true } },
    rollupOptions: {
      output: {
        manualChunks: {
          'monaco': ['monaco-editor'],
          'react-vendor': ['react', 'react-dom'],
          'zustand': ['zustand'],
          'ai-sdk': ['@anthropic-ai/sdk', 'openai'],
        },
        chunkFileNames: 'assets/[name]-[hash].js',
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]',
      }
    },
    chunkSizeWarningLimit: 1000,
  },
  server: { port: 5173, strictPort: true, hmr: { overlay: true } },
  optimizeDeps: { include: ['monaco-editor', 'react', 'react-dom', 'zustand'] },
  esbuild: { legalComments: 'none' },
});
