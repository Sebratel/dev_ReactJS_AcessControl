import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    outDir: 'dist',
  },
  server: {
    // 5173: origem já liberada no cliente OAuth das dashboards. strictPort: se a
    // porta estiver ocupada (outra dashboard rodando), falha em vez de pular para
    // uma porta que o Google recusaria no login (origin_mismatch)
    port: 5173,
    strictPort: true,
    proxy: {
      // em desenvolvimento a API roda à parte; em produção o mesmo servidor
      // entrega a SPA e a API, então não há CORS em lugar nenhum
      '/api': {
        target: process.env.API_URL || 'http://127.0.0.1:8095',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
});
