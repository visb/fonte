// Matchers do @testing-library/react-native (toHaveTextContent, etc.)
// e cleanup automático entre testes.
import '@testing-library/react-native/extend-expect';

// lib/api e lib/auth importam @react-native-async-storage/async-storage; sob
// jest-expo o módulo nativo não existe. Mock oficial in-memory (mesma decisão
// da story 81 — ops.fonte) para qualquer teste que toque lib/api transitivamente.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

// @expo/vector-icons puxa expo-font, que sob jest-expo falha ao carregar fontes
// nativas (loadedNativeFonts.forEach is not a function). Os ícones não têm texto
// relevante para os testes, então mockamos cada conjunto como um componente
// trivial que apenas reflete o name em accessibilityLabel.
jest.mock('@expo/vector-icons', () => {
  const React = require('react');
  const { Text } = require('react-native');
  const makeIcon = (family) => {
    const Icon = ({ name }) =>
      React.createElement(Text, { accessibilityLabel: `${family}:${name}` });
    Icon.displayName = family;
    return Icon;
  };
  return new Proxy(
    {},
    {
      get: (_target, prop) => makeIcon(String(prop)),
    },
  );
});
