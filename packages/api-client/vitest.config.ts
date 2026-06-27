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
      // Catraca: story 90 sobe statements para 90 (já em 99,06%, passa com folga);
      // branches/functions/lines travados no valor efetivamente atingido.
      thresholds: {
        statements: 90,
        branches: 99,
        functions: 98,
        lines: 99,
      },
    },
  },
});
