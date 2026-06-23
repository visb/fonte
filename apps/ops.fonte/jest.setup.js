// Matchers do @testing-library/react-native (toHaveTextContent, etc.)
// e cleanup automático entre testes.
import '@testing-library/react-native/extend-expect';

// AsyncStorage não tem módulo nativo no jest: usa o mock oficial.
// lib/api.ts (createApiClient + getToken) é importado por quase todo componente.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
