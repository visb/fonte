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
        // Story 82 — orquestração de páginas é coberta por E2E (Playwright);
        // init do Sentry não dispara sem DSN em testes.
        'src/**/pages/**',
        'src/lib/sentry.ts',
      ],
      // Catraca (story 82): piso de 80% em statements; branches/functions/lines
      // travados no valor efetivamente atingido (arredondado para baixo).
      thresholds: {
        statements: 80,
        branches: 77,
        functions: 87,
        lines: 83,
      },
    },
  },
});
