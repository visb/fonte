import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      all: true,
      reporter: ['text', 'text-summary'],
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/index.ts'],
      // Catraca (story 82): piso de 80% em statements; branches/functions/lines
      // travados no valor efetivamente atingido (arredondado para baixo).
      thresholds: {
        statements: 80,
        branches: 99,
        functions: 98,
        lines: 99,
      },
    },
  },
});
