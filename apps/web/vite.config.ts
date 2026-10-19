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
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|react-router|@tanstack|zustand)[\\/]/ },
            { name: 'icons', test: /node_modules[\\/]react-iconly[\\/]/ },
            // asm.js 빌드(WebAssembly 대체용)는 필요할 때만 받도록 묶지 않음
            { name: 'sqljs', test: /node_modules[\\/]sql\.js[\\/]dist[\\/]sql-wasm/ },
            { name: 'core', test: /(packages[\\/]core[\\/]src|node_modules[\\/](zod|@noble)[\\/])/ },
            // 플러그인의 웹 구현(web.js)은 모듈을 읽는 순간 실행되는 코드가 있어(예: 위치 플러그인의 방향 센서 구독)
            // 한 덩어리로 묶지 않고 필요할 때만 불러오도록 core만 묶음
            { name: 'capacitor', test: /node_modules[\\/]@capacitor[\\/]core[\\/]/ },
          ],
        },
      },
    },
  },
  test: {
    include: ['src/**/*.test.ts'],
  },
});
