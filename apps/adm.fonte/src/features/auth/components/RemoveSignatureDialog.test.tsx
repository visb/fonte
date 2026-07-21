import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';

const removeMySignature = vi.fn(() => Promise.resolve({ signatureUrl: null }));
vi.mock('@/lib/api', () => ({
  api: { staff: { removeMySignature: () => removeMySignature() } },
}));

import { RemoveSignatureDialog } from './RemoveSignatureDialog';

function wrapper() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('RemoveSignatureDialog', () => {
  it('não renderiza o conteúdo quando fechado', () => {
    render(<RemoveSignatureDialog open={false} onClose={() => {}} />, { wrapper: wrapper() });
    expect(screen.queryByText('Remover assinatura?')).not.toBeInTheDocument();
  });

  it('confirmar chama a API e fecha ao concluir', async () => {
    const onClose = vi.fn();
    render(<RemoveSignatureDialog open onClose={onClose} />, { wrapper: wrapper() });

    fireEvent.click(screen.getByRole('button', { name: /^Remover$/ }));

    await waitFor(() => expect(removeMySignature).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('cancelar fecha sem chamar a API', () => {
    const onClose = vi.fn();
    render(<RemoveSignatureDialog open onClose={onClose} />, { wrapper: wrapper() });

    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));

    expect(removeMySignature).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('exibe mensagem de erro quando a remoção falha', async () => {
    removeMySignature.mockRejectedValueOnce(new Error('boom'));
    render(<RemoveSignatureDialog open onClose={() => {}} />, { wrapper: wrapper() });

    fireEvent.click(screen.getByRole('button', { name: /^Remover$/ }));

    expect(await screen.findByText(/Erro ao remover assinatura|boom/)).toBeInTheDocument();
  });
});
