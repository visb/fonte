import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { PixPaymentResult } from '@fonte/types';
import { PixPayment } from './PixPayment';

function pix(overrides: Partial<PixPaymentResult> = {}): PixPaymentResult {
  return {
    qrCode: '00020126br-pix-copia-e-cola',
    qrCodeUrl: 'https://cdn/qr.png',
    expiresAt: null,
    ...overrides,
  };
}

function mockClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText },
    configurable: true,
  });
}

describe('PixPayment (story 70)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('renderiza o QR code e o código copia-e-cola', () => {
    render(<PixPayment pix={pix()} />);
    expect(screen.getByRole('heading', { name: /pague com pix/i })).toBeInTheDocument();
    expect(screen.getByAltText(/qr code do pix/i)).toHaveAttribute('src', 'https://cdn/qr.png');
    expect(screen.getByLabelText(/código copia-e-cola/i)).toHaveValue('00020126br-pix-copia-e-cola');
  });

  it('não renderiza imagem nem código quando ausentes', () => {
    render(<PixPayment pix={pix({ qrCode: null, qrCodeUrl: null })} />);
    expect(screen.queryByAltText(/qr code do pix/i)).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copiar código pix/i })).not.toBeInTheDocument();
  });

  it('copia o código e mostra "Copiado!"', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    mockClipboard(writeText);

    render(<PixPayment pix={pix()} />);
    fireEvent.click(screen.getByRole('button', { name: /copiar código pix/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /copiado!/i })).toBeInTheDocument(),
    );
    expect(writeText).toHaveBeenCalledWith('00020126br-pix-copia-e-cola');
  });

  it('mantém o estado quando a cópia falha', async () => {
    const writeText = vi.fn().mockRejectedValue(new Error('denied'));
    mockClipboard(writeText);

    render(<PixPayment pix={pix()} />);
    fireEvent.click(screen.getByRole('button', { name: /copiar código pix/i }));

    await waitFor(() => expect(writeText).toHaveBeenCalled());
    expect(screen.getByRole('button', { name: /copiar código pix/i })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /copiado!/i })).not.toBeInTheDocument();
  });
});
