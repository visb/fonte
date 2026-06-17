// Carrega as tipagens dos matchers do @testing-library/react-native
// (toBeOnTheScreen, toHaveTextContent, etc.) para o tsc reconhecê-los
// nos testes. O runtime é registrado em jest.setup.js.
import '@testing-library/react-native/extend-expect';
