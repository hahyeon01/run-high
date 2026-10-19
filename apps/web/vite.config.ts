import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  // 상대 경로: Capacitor(Android), GitHub Pages 하위 경로, 정적 호스팅 어디서나 동작
  base: './',
  plugins: [react(), tailwindcss()],
  server: { port: 5173, host: true },
  preview: { port: 4173, host: true },
  build: {
    target: 'es2022',
    chunkSizeWarningLimit: 1500,
    assetsInlineLimit: 0,
    rolldownOptions: {
      output: {
        // 자주 바뀌지 않는 라이브러리는 따로 묶어 캐시 효율을 높임
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router|@tanstack|zustand)[\\/]/ },
            { name: 'icons', test: /node_modules[\\/]react-iconly[\\/]/ },
            { name: 'sqljs', test: /node_modules[\\/]sql\.js[\\/]/ },
            { name: 'core', test: /(packages[\\/]core[\\/]src|node_modules[\\/](zod|@noble)[\\/])/ },
            { name: 'capacitor', test: /node_modules[\\/](@capacitor|capacitor-health)[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
