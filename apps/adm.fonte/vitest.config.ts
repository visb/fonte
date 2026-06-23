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
        // Shell de roteamento/layout (react-router-dom) — orquestração coberta
        // por E2E Playwright, não por unit. (story 80)
        'src/App.tsx',
        'src/components/layout/AppLayout.tsx',
        // Editor TipTap e seus menus — wiring fino de @tiptap/* + ProseMirror.
        // Editor real exige um DOM/contenteditable de browser que o jsdom não
        // implementa; comportamento coberto por E2E. (story 80)
        'src/features/settings/components/TemplateEditor.tsx',
        'src/features/settings/components/TableBlockMenu.tsx',
        'src/features/settings/components/TableToolbar.tsx',
        'src/features/settings/components/LinkToolbar.tsx',
        'src/features/settings/components/LinkBubbleMenu.tsx',
        'src/features/activities/components/ActivityDescriptionEditor.tsx',
        // AvatarUpload — react-easy-crop + react-webcam (getUserMedia / canvas de
        // crop). APIs de mídia do browser indisponíveis no jsdom. (story 80)
        'src/components/AvatarUpload.tsx',
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
      // exclui orquestração (App/AppLayout/TipTap editors+menus/AvatarUpload) do
      // denominador — re-baseline honesto 48.82%→54.94% SEM teste novo. (story 80)
      // climbing 12 (import wizard steps + AttachmentsTab + ReadmissionForm +
      //   residents/houses OverviewTab): 64.96% statements.
      // climbing 13 (reset-password dialogs + ActivityDetailsDialog + payables
      //   detail/row/filters): 69.80% statements.
      // climbing 14 (residents: ContributionPlanCard/RelativeCard/
      //   ResidentsFilters/ReceivableRow/TrackingEventItem): 72.11% statements.
      // climbing 15 (Approve/CapacityActions/ActivityForm/PayableDialog/
      //   MissingFieldsDialog/Contributions+Relatives tabs): 75.79% statements.
      // climbing 16 (associates detail/row + SalesSummaryCards + AdmissionsTab +
      //   NotificationsPanel + HouseFormFields): 79.01% statements.
      // climbing 17 (PayablesSummaryCards + OverviewIndicesCards + RegistrationCard):
      //   80.02% statements — META 80% ATINGIDA. Catraca final.
      thresholds: {
        statements: 80,
        branches: 83,
        functions: 80,
        lines: 80,
      },
    },
  },
});
