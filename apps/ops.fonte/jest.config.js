module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  // Mede cobertura sobre todo o código-fonte, não só arquivos importados por testes.
  collectCoverageFrom: [
    'components/**/*.{ts,tsx}',
    'features/**/*.{ts,tsx}',
    'lib/**/*.{ts,tsx}',
    '!**/*.test.{ts,tsx}',
    '!**/*.d.ts',
    '!**/_layout.tsx',
    // Rotas Expo Router (app/**) sao orquestracao de navegacao/telas → cobertas por
    // Maestro E2E, fora do denominador unit (decisao travada story 81 / AUTORUN honestidade).
    '!app/**/*.{ts,tsx}',
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
  // Catraca de cobertura (story 81): sobe a cada sub-fase, nunca desce. Meta final 80%.
  coverageThreshold: {
    global: { statements: 27, branches: 25, functions: 24, lines: 28 },
  },
};
