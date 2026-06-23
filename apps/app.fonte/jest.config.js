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
    // Rotas Expo Router (app/**) e telas de orquestração (features/**/pages/**)
    // são wiring de navegação/composição, cobertos por E2E (Maestro/Playwright web),
    // não por unit. Excluídos do denominador (mesma decisão da story 81 — ops.fonte).
    '!app/**',
    '!features/**/pages/**',
    // Helpers de teste não entram no denominador de cobertura.
    '!lib/test/**',
  ],
  // Catraca de cobertura (story 84). Sobe a cada sub-fase mergeada, nunca desce.
  coverageThreshold: {
    global: { statements: 6, branches: 5, functions: 8, lines: 7 },
  },
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
};
