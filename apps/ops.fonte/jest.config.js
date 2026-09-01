// `--forceExit` nos scripts `test:unit*` do package.json (não cabe comentário lá).
// Sem ele o jest-expo NÃO SAI depois de a suíte terminar verde: imprime "Jest did
// not exit one second after the test run has completed" e o processo fica vivo.
// No CI isso derrubou o gate duas vezes — run 33412759785 (ops.fonte segurou
// 1h49min até heap out of memory, exit 134) e run 33512261148 (app.fonte segurou
// até o teto de 20 min). Não reproduz em máquina local, e `--detectOpenHandles`
// (serial) sai limpo: o handle é do ambiente do jest-expo, não de código do app.
module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Mede cobertura sobre todo o código-fonte, não só arquivos importados por testes.
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'features/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/__mocks__/**',
    '!**/*.d.ts',
    '!**/_layout.tsx',
    // Rotas Expo Router (app/**) sao orquestracao de navegacao/telas → cobertas por
    // Maestro E2E, fora do denominador unit (decisao travada story 81 / AUTORUN honestidade).
    '!app/**/*.{ts,tsx}',
    // Config de build e bancada (app.config.js, scripts/build-e2e-android.js — story
    // 184, scripts/maestro-flakiness-run.js — story 187) ficam fora do denominador do
    // app, mesmo criterio de app/**: nao e codigo embarcado. Cada um tem spec dedicado
    // (tests/appConfig.test.ts, tests/buildE2eAndroid.test.ts, tests/maestroFlakinessRun.test.ts).
    // Pages de feature sao orquestracao (layout + composicao de hooks/componentes,
    // sem logica de negocio — CLAUDE.md: "pages nao fazem fetch"). Cobertas por
    // Maestro E2E nativo. Mesmo criterio do adm.fonte (src/**/pages/** excluido na story 80).
    '!features/**/pages/**',
  ],
  // Unit tests ficam ao lado do código (*.test.ts(x)).
  // Maestro (e2e/) e Playwright web (e2e-web/) NÃO são coletados pelo jest.
  testPathIgnorePatterns: [
    '/node_modules/',
    '/e2e/',
    '/e2e-web/',
    '/dist/',
    '/.expo/',
  ],
  // Resolve o alias '@/...' do tsconfig (paths: { '@/*': ['./*'] }).
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop|@fonte/.*))',
  ],
  // Catraca de cobertura (story 88): meta 90% statements ATINGIDA (81.4 -> 91.3).
  // Travada no piso de 90% statements; branches/functions/lines no valor atingido
  // (so sobe, nunca desce). Medido: 91.3 stmt / 81.12 br / 89.97 fn / 93.1 ln.
  coverageThreshold: {
    global: { statements: 90, branches: 81, functions: 89, lines: 93 },
  },
};
