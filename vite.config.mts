
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],

  resolve: {
    alias: {
      'react-native': 'react-native-web',
      '@': path.resolve(projectRoot, 'src'),
    },
    extensions: [
      '.web.tsx',
      '.web.ts',
      '.tsx',
      '.ts',
      '.jsx',
      '.js',
    ],
  },

  define: {
    __DEV__: JSON.stringify(process.env.NODE_ENV !== 'production'),
  },

  server: {
    host: '0.0.0.0',
    port: 5173,
  },
});
