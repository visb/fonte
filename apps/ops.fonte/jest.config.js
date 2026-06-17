module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
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
