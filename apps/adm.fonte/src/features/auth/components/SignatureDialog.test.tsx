import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mutate = vi.fn();
const reset = vi.fn();
const mockMutation = {
  mutate,
  reset,
  isPending: false,
  isError: false,
  error: null as unknown,
};

vi.mock('@/features/staff/hooks/useStaff', () => ({
  useUploadMySignature: () => mockMutation,
}));

// Blobs identificáveis: o teste precisa provar QUAL blob foi salvo (decisão 9).
const mockDrawBlob = new Blob(['draw'], { type: 'image/png' });
const mockUploadBlob = new Blob(['upload'], { type: 'image/png' });

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
          toBlob: (cb: (b: Blob) => void) => cb(mockDrawBlob),
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

// O pad de upload tem teste próprio (canvas/createImageBitmap não existem no jsdom);
// aqui interessa só o contrato com o dialog: emite blob, e o clearSignal descarta.
vi.mock('./SignatureUploadPad', async () => {
  const React = await import('react');
  return {
    SignatureUploadPad: ({
      onChange,
      clearSignal,
    }: {
      onChange: (blob: Blob | null) => void;
      clearSignal: number;
    }) => {
      React.useEffect(() => {
        if (clearSignal > 0) onChange(null);
      }, [clearSignal]);
      return React.createElement('button', {
        'data-testid': 'pick-image',
        onClick: () => onChange(mockUploadBlob),
      });
    },
  };
});

import { SignatureDialog } from './SignatureDialog';

const saveButton = () => screen.getByRole('button', { name: 'Salvar' });
const goToTab = (name: string) => userEvent.click(screen.getByRole('tab', { name }));

beforeEach(() => {
  vi.clearAllMocks();
  mockMutation.isPending = false;
  mockMutation.isError = false;
  mockMutation.error = null;
});
afterEach(() => cleanup());

describe('SignatureDialog', () => {
  it('abre na aba "Desenhar" e oferece a aba "Enviar imagem"', () => {
    render(<SignatureDialog open onClose={vi.fn()} />);
    expect(screen.getByRole('tab', { name: 'Desenhar' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: 'Enviar imagem' })).toHaveAttribute(
      'aria-selected',
      'false',
    );
  });

  it('bloqueia salvar enquanto o canvas está vazio', () => {
    render(<SignatureDialog open onClose={vi.fn()} />);
    expect(saveButton()).toBeDisabled();
    expect(mutate).not.toHaveBeenCalled();
  });

  it('"Limpar" zera o canvas', () => {
    render(<SignatureDialog open onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('draw'));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));
    expect(clearSpy).toHaveBeenCalled();
    expect(saveButton()).toBeDisabled();
  });

  it('salvar envia o Blob PNG do traço e dispara onSaved', async () => {
    mutate.mockImplementation((_blob: Blob, opts: { onSuccess?: () => void }) => opts.onSuccess?.());
    const onSaved = vi.fn();
    const onClose = vi.fn();
    render(<SignatureDialog open onClose={onClose} onSaved={onSaved} />);

    fireEvent.click(screen.getByTestId('draw'));
    fireEvent.click(saveButton());

    await waitFor(() => expect(mutate).toHaveBeenCalled());
    const blob = mutate.mock.calls[0][0] as Blob;
    expect(blob).toBe(mockDrawBlob);
    expect(blob.type).toBe('image/png');
    expect(onSaved).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('na aba de envio, salvar só habilita com imagem escolhida', async () => {
    render(<SignatureDialog open onClose={vi.fn()} />);

    await goToTab('Enviar imagem');
    expect(saveButton()).toBeDisabled();

    fireEvent.click(screen.getByTestId('pick-image'));
    expect(saveButton()).toBeEnabled();
  });

  it('salva o blob da aba ATIVA, não o da outra aba', async () => {
    render(<SignatureDialog open onClose={vi.fn()} />);

    // desenha na aba 1 e escolhe imagem na aba 2; a aba ativa ao salvar é a de envio.
    fireEvent.click(screen.getByTestId('draw'));
    await goToTab('Enviar imagem');
    fireEvent.click(screen.getByTestId('pick-image'));
    fireEvent.click(saveButton());

    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0][0]).toBe(mockUploadBlob);
  });

  it('trocar de aba preserva o traço já desenhado', async () => {
    render(<SignatureDialog open onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('draw'));
    await goToTab('Enviar imagem');
    expect(saveButton()).toBeDisabled();

    await goToTab('Desenhar');
    expect(saveButton()).toBeEnabled();

    fireEvent.click(saveButton());
    await waitFor(() => expect(mutate).toHaveBeenCalledTimes(1));
    expect(mutate.mock.calls[0][0]).toBe(mockDrawBlob);
  });

  it('"Limpar" na aba de envio descarta a imagem sem apagar o traço', async () => {
    render(<SignatureDialog open onClose={vi.fn()} />);

    fireEvent.click(screen.getByTestId('draw'));
    await goToTab('Enviar imagem');
    fireEvent.click(screen.getByTestId('pick-image'));
    fireEvent.click(screen.getByRole('button', { name: 'Limpar' }));

    expect(saveButton()).toBeDisabled();
    expect(clearSpy).not.toHaveBeenCalled();

    await goToTab('Desenhar');
    expect(saveButton()).toBeEnabled();
  });

  it('fechar e reabrir zera as duas abas', async () => {
    const onClose = vi.fn();
    const { rerender } = render(<SignatureDialog open onClose={onClose} />);

    fireEvent.click(screen.getByTestId('draw'));
    await goToTab('Enviar imagem');
    fireEvent.click(screen.getByTestId('pick-image'));
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));

    expect(onClose).toHaveBeenCalled();
    expect(reset).toHaveBeenCalled();

    rerender(<SignatureDialog open={false} onClose={onClose} />);
    rerender(<SignatureDialog open onClose={onClose} />);

    expect(screen.getByRole('tab', { name: 'Desenhar' })).toHaveAttribute('aria-selected', 'true');
    expect(saveButton()).toBeDisabled();
    await goToTab('Enviar imagem');
    expect(saveButton()).toBeDisabled();
  });

  it('mostra o erro da mutation e o rótulo de salvamento em andamento', () => {
    mockMutation.isError = true;
    mockMutation.error = { response: { data: { message: 'Arquivo inválido' } } };
    mockMutation.isPending = true;
    render(<SignatureDialog open onClose={vi.fn()} />);

    expect(screen.getByText('Arquivo inválido')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Salvando...' })).toBeDisabled();
  });
});
