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
        // Story 90 — App.tsx é o shell do roteador (orquestração pura: providers +
        // <Routes>), análogo ao App/AppLayout do adm excluído na story 80. Coberto
        // por E2E (Playwright); re-baseline registrado no PROGRESS, não progresso de teste.
        'src/App.tsx',
      ],
      // Catraca: story 90 sobe statements para o piso 90 (atingido 99,16%);
      // branches/functions/lines travados no valor efetivamente atingido
      // (arredondado para baixo). Catraca só sobe, nunca desce.
      thresholds: {
        statements: 90,
        branches: 86,
        functions: 98,
        lines: 99,
      },
    },
  },
});
