import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const state = { signatureUrl: null as string | null };
const removeMutation = {
  mutate: vi.fn(),
  isPending: false,
  isError: false,
  error: null as unknown,
};

vi.mock('@/features/staff/hooks/useStaff', () => ({
  useStaffMe: () => ({ data: { signatureUrl: state.signatureUrl } }),
  useRemoveMySignature: () => removeMutation,
}));
vi.mock('@/lib/api', () => ({
  api: { photoUrl: (u: string | null) => u },
}));
vi.mock('./SignatureDialog', () => ({
  SignatureDialog: ({ open }: { open: boolean }) =>
    open ? <div data-testid="signature-dialog" /> : null,
}));

import { SignatureSection } from './SignatureSection';

beforeEach(() => {
  vi.clearAllMocks();
  state.signatureUrl = null;
  removeMutation.isPending = false;
  removeMutation.isError = false;
  removeMutation.error = null;
});
afterEach(() => cleanup());

describe('SignatureSection', () => {
  it('mostra o vazio e o botão de configurar quando não há assinatura', () => {
    render(<SignatureSection />);
    expect(screen.getByText('Nenhuma assinatura configurada.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Configurar assinatura/ })).toBeInTheDocument();
  });

  it('não mostra o botão "Redefinir" quando não há assinatura', () => {
    render(<SignatureSection />);
    expect(screen.queryByRole('button', { name: /Redefinir/ })).not.toBeInTheDocument();
  });

  it('mostra a imagem, o botão de redesenhar e o de redefinir quando há assinatura', () => {
    state.signatureUrl = 'https://cdn/sig.png';
    render(<SignatureSection />);
    const img = screen.getByAltText('Sua assinatura') as HTMLImageElement;
    expect(img.src).toContain('https://cdn/sig.png');
    expect(screen.getByRole('button', { name: /Redesenhar/ })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Redefinir/ })).toBeInTheDocument();
  });

  it('o botão de assinar abre o diálogo de assinatura', () => {
    render(<SignatureSection />);
    expect(screen.queryByTestId('signature-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Configurar assinatura/ }));
    expect(screen.getByTestId('signature-dialog')).toBeInTheDocument();
  });

  it('"Redefinir" abre o AlertDialog de confirmação', () => {
    state.signatureUrl = 'https://cdn/sig.png';
    render(<SignatureSection />);
    expect(screen.queryByText('Remover assinatura?')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Redefinir/ }));
    expect(screen.getByText('Remover assinatura?')).toBeInTheDocument();
  });

  it('confirmar no AlertDialog dispara a mutation de remoção', () => {
    state.signatureUrl = 'https://cdn/sig.png';
    render(<SignatureSection />);
    fireEvent.click(screen.getByRole('button', { name: /Redefinir/ }));
    fireEvent.click(screen.getByRole('button', { name: /^Remover$/ }));
    expect(removeMutation.mutate).toHaveBeenCalledTimes(1);
  });

  it('cancelar no AlertDialog não remove', () => {
    state.signatureUrl = 'https://cdn/sig.png';
    render(<SignatureSection />);
    fireEvent.click(screen.getByRole('button', { name: /Redefinir/ }));
    fireEvent.click(screen.getByRole('button', { name: /Cancelar/ }));
    expect(removeMutation.mutate).not.toHaveBeenCalled();
  });

  it('exibe o estado de erro e o rótulo de carregamento ao remover', () => {
    state.signatureUrl = 'https://cdn/sig.png';
    removeMutation.isError = true;
    removeMutation.error = new Error('falhou');
    removeMutation.isPending = true;
    render(<SignatureSection />);
    fireEvent.click(screen.getByRole('button', { name: /Redefinir/ }));
    expect(screen.getByText(/Erro ao remover assinatura|falhou/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Removendo/ })).toBeInTheDocument();
  });
});
