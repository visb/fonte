import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';

const mockPad = {
  empty: true,
  blob: null as Blob | null,
  clear: vi.fn(),
};

// Fake do react-signature-canvas: o botão dispara onEnd como faria o fim do traço.
vi.mock('react-signature-canvas', async () => {
  const React = await import('react');
  const SignatureCanvas = React.forwardRef(
    (props: { onEnd?: () => void }, ref: React.Ref<unknown>) => {
      React.useImperativeHandle(ref, () => ({
        isEmpty: () => mockPad.empty,
        clear: () => {
          mockPad.clear();
          mockPad.empty = true;
        },
        getCanvas: () => ({
          toBlob: (cb: (b: Blob | null) => void) => cb(mockPad.blob),
        }),
      }));
      return React.createElement('button', { 'data-testid': 'draw', onClick: props.onEnd });
    },
  );
  return { default: SignatureCanvas };
});

import { SignatureDrawPad } from './SignatureDrawPad';

beforeEach(() => {
  vi.clearAllMocks();
  mockPad.empty = false;
  mockPad.blob = new Blob(['png'], { type: 'image/png' });
});
afterEach(() => cleanup());

describe('SignatureDrawPad', () => {
  it('emite o PNG do traço ao terminar de desenhar', async () => {
    const onChange = vi.fn();
    render(<SignatureDrawPad onChange={onChange} clearSignal={0} />);

    fireEvent.click(screen.getByTestId('draw'));

    await waitFor(() => expect(onChange).toHaveBeenCalledWith(mockPad.blob));
  });

  it('emite null quando o pad continua vazio', () => {
    mockPad.empty = true;
    const onChange = vi.fn();
    render(<SignatureDrawPad onChange={onChange} clearSignal={0} />);

    fireEvent.click(screen.getByTestId('draw'));

    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('mostra erro quando o canvas não produz a imagem', async () => {
    mockPad.blob = null;
    const onChange = vi.fn();
    render(<SignatureDrawPad onChange={onChange} clearSignal={0} />);

    fireEvent.click(screen.getByTestId('draw'));

    expect(
      await screen.findByText('Não foi possível gerar a imagem da assinatura.'),
    ).toBeInTheDocument();
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('o sinal de limpar zera o pad e emite null', async () => {
    const onChange = vi.fn();
    const { rerender } = render(<SignatureDrawPad onChange={onChange} clearSignal={0} />);

    fireEvent.click(screen.getByTestId('draw'));
    await waitFor(() => expect(onChange).toHaveBeenCalledWith(mockPad.blob));
    onChange.mockClear();

    rerender(<SignatureDrawPad onChange={onChange} clearSignal={1} />);

    expect(mockPad.clear).toHaveBeenCalledTimes(1);
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('não limpa o pad na montagem inicial', () => {
    render(<SignatureDrawPad onChange={vi.fn()} clearSignal={0} />);
    expect(mockPad.clear).not.toHaveBeenCalled();
  });
});
