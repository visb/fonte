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
      reporter: ['text', 'text-summary'],
      // Foco da cobertura: a lógica pura testável (helpers de transição/resolução).
      // Componentes com DnD/efeitos são cobertos pelos E2E (Playwright).
      include: ['src/features/activities/lib/**'],
    },
  },
});
