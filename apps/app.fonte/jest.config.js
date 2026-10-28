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
  // Primeiro teste de cada arquivo paga o carregamento frio do react-native sob
  // coverage; no runner do CI isso passou dos 5s padrão (lib/auth.test.tsx, runs
  // 39518198770 e 40741267769) e derrubou o gate — e com ele o deploy da main.
  testTimeout: 20000,
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
  // Catraca de cobertura (stories 84, 89). Sobe a cada sub-fase mergeada, nunca desce.
  coverageThreshold: {
    global: { statements: 90, branches: 81, functions: 91, lines: 93 },
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
