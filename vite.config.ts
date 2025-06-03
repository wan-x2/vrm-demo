import { defineConfig } from 'vite';

export default defineConfig({
  base: process.env.BASE_URL || '/',
  server: {
    port: 5173
  },
  optimizeDeps: {
    include: ['@mediapipe/holistic', '@mediapipe/drawing_utils']
  }
});