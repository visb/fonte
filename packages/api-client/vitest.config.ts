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
      // types.ts é só declaração de tipo: não tem código executável, e contá-lo
      // como 0% é ruído de medição, não cobertura faltando.
      exclude: ['src/**/*.test.ts', 'src/**/*.d.ts', 'src/index.ts', 'src/types.ts'],
      // Piso em 95 por decisão do usuário (2026-08-29). O valor anterior
      // (99/98) foi travado pela story 90 no que se atingia então, mas o gate do
      // CI estava quebrado no setup do Node e nunca reprovou — então métodos
      // novos entraram sem teste sem ninguém ver.
      //
      // PENDENTE: bible-course.ts está em 72,46% e é a lacuna real que sobrou
      // (residents.ts foi a 100% junto com esta mudança). Vale story própria.
      thresholds: {
        statements: 95,
        branches: 95,
        functions: 95,
        lines: 95,
      },
    },
  },
});
