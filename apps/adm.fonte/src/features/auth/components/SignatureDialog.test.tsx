import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const mutate = vi.fn();
const reset = vi.fn();

vi.mock('@/features/staff/hooks/useStaff', () => ({
  useUploadMySignature: () => ({ mutate, reset, isPending: false, isError: false, error: null }),
}));

// Fake do canvas de assinatura: expõe isEmpty/clear/getCanvas via ref; o botão
// interno simula um traço, marcando o pad como não-vazio e disparando onEnd.
const clearSpy = vi.fn();
vi.mock('react-signature-canvas', async () => {
  const React = await import('react');
  const SignatureCanvas = React.forwardRef(
    (props: { onEnd?: () => void }, ref: React.Ref<unknown>) => {
      const emptyRef = React.useRef(true);
      React.useImperativeHandle(ref, () => ({
        isEmpty: () => emptyRef.current,
        clear: () => {
          clearSpy();
          emptyRef.current = true;
        },
        getCanvas: () => ({
          toBlob: (cb: (b: Blob) => void) => cb(new Blob(['png'], { type: 'image/png' })),
        }),
      }));
      return React.createElement('button', {
        'data-testid': 'draw',
        onClick: () => {
          emptyRef.current = false;
          props.onEnd?.();
        },
      });
    },
  );
  return { default: SignatureCanvas };
});

import { SignatureDialog } from './SignatureDialog';

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('SignatureDialog', () => {
  it('bloqueia salvar enquanto o canvas está vazio', () => {
    render(<SignatureDialog open onClose={vi.fn()} />);
    const save = screen.getByRole('button', { name: 'Salvar' });
    expect(save).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('"Limpar" zera o canvas', () => {
    render(<SignatureDialog open onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('draw'));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(clearSpy).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Salvar' })).toBeDisabled();
  });

  it('salvar envia um Blob PNG e dispara onSaved', async () => {
    mutate.mockImplementation((_blob: Blob, opts: { onSuccess?: () => void }) => opts.onSuccess?.());
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<SignatureDialog open onClose={onClose} onSaved={onSaved} />);

    fireEvent.click(screen.getByTestId('draw'));
    fireEvent.click(screen.getByRole('button', { name: 'Salvar' }));

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const blob = mutate.mock.calls[0][0] as Blob;
    expect(blob).toBeInstanceOf(Blob);
    expect(blob.type).toBe('image/png');
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});
