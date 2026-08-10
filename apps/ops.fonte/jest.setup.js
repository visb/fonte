// Matchers do @testing-library/react-native (toHaveTextContent, etc.)
// e cleanup automático entre testes.
import '@testing-library/react-native/extend-expect';

// AsyncStorage não tem módulo nativo no jest: usa o mock oficial.
// lib/api.ts (createApiClient + getToken) é importado por quase todo componente.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// O ambiente do jest-expo não tem FileReader (o navegador tem). A outbox usa
// FileReader para persistir anexo como data URL no web (story 169), então o
// polyfill mínimo aqui mantém esse caminho testável.
if (typeof global.FileReader === 'undefined') {
  global.FileReader = class FileReader {
    readAsDataURL(blob) {
      blob
        .arrayBuffer()
        .then((buffer) => {
          const base64 = Buffer.from(buffer).toString('base64');
          this.result = `data:${blob.type || 'application/octet-stream'};base64,${base64}`;
          this.onloadend?.();
        })
        .catch((error) => {
          this.error = error;
          this.onerror?.();
        });
    }
  };
}
