import { defineConfig } from 'vite';

export default defineConfig({
  server: {
    port: 5173
  },
  optimizeDeps: {
    include: ['@mediapipe/holistic', '@mediapipe/drawing_utils']
  }
});