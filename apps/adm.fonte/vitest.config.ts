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
      reporter: ['text-summary', 'json-summary', 'json'],
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
      // 80b (houses+payables+billing): 19% statements.
      // 80c (events+support-groups+associates+census): 20% statements.
      // 80d (messages+notifications+bible-courses): 25% statements.
      // 80e (backup+settings+dashboard+auth): 27% statements.
      // climbing 1 (forms: payable/event/associate): 30% statements.
      // climbing 2 (dialogs: resident access/promote, support-group): 33% statements.
      // climbing 3 (ActivityCard + StaffOverviewTab): 35% statements.
      // climbing 4 (PersonalDataFields + BibleClassDialog): 36% statements.
      // climbing 5 (PayPayable/BibleModule/AddMinistry dialogs): 38% statements.
      // climbing 6 (RegisterPayment/ChangePlan/QuickAdd): 40% statements.
      // climbing 7 (EventTimelineItem + ResidentsTab): 42% statements.
      // climbing 8 (AddFollowUpDialog + PrivacyTab): 44% statements.
      // climbing 9 (ActivityBoard + ResidentFormSections): 45% statements.
      // climbing 10 (ActivityComments + BibleModuleGradesDialog): 47% statements.
      // climbing 11 (ImportReviewStep + ThreadPanel): 48% statements.
      thresholds: {
        statements: 48,
        branches: 81,
        functions: 79,
        lines: 48,
      },
    },
  },
});
