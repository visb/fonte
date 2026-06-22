import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['src/**/*.test.{ts,tsx}'],
    // e2e/** é Playwright — fora do Vitest.
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    coverage: {
      provider: 'v8',
      all: true,
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/**/*.test.{ts,tsx}',
        'src/**/*.d.ts',
        'src/main.tsx',
        'src/vite-env.d.ts',
        // Utilitários de teste reutilizáveis (factory de QueryClient/provider).
        'src/test/**',
        // Pages são orquestração (layout + composição de hooks/componentes) —
        // cobertas por E2E Playwright, fora do denominador unitário (story 80).
        'src/**/pages/**',
      ],
      // Catraca de cobertura (story 80). Sobe a cada sub-fase (80a→80e), nunca
      // desce. Re-baseline honesto após excluir pages: 7.16% statements.
      // 80a (residents+activities+staff): 16% statements.
      thresholds: {
        statements: 16,
        branches: 68,
        functions: 52,
        lines: 16,
      },
    },
  },
});
