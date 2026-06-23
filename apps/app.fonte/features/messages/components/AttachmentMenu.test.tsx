import { render, screen, fireEvent } from '@testing-library/react-native';
import { AttachmentMenu } from './AttachmentMenu';

function setup(overrides: Partial<React.ComponentProps<typeof AttachmentMenu>> = {}) {
  const props = {
    visible: true,
    onClose: jest.fn(),
    onCamera: jest.fn(),
    onGallery: jest.fn(),
    onDocuments: jest.fn(),
    accentColor: '#7c3aed',
    ...overrides,
  };
  render(<AttachmentMenu {...props} />);
  return props;
}

describe('AttachmentMenu', () => {
  it('mostra as três opções de envio quando visível', () => {
    setup();
    expect(screen.getByText('Câmera')).toBeOnTheScreen();
    expect(screen.getByText('Galeria')).toBeOnTheScreen();
    expect(screen.getByText('Documento')).toBeOnTheScreen();
  });

  it('dispara onCamera ao tocar em Câmera', () => {
    const props = setup();
    fireEvent.press(screen.getByText('Câmera'));
    expect(props.onCamera).toHaveBeenCalledTimes(1);
  });

  it('dispara onGallery ao tocar em Galeria', () => {
    const props = setup();
    fireEvent.press(screen.getByText('Galeria'));
    expect(props.onGallery).toHaveBeenCalledTimes(1);
  });

  it('dispara onDocuments ao tocar em Documento', () => {
    const props = setup();
    fireEvent.press(screen.getByText('Documento'));
    expect(props.onDocuments).toHaveBeenCalledTimes(1);
  });

  it('dispara onClose ao tocar em Cancelar', () => {
    const props = setup();
    fireEvent.press(screen.getByText('Cancelar'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
  });
});
