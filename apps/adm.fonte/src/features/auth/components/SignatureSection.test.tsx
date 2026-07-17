import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const state = { signatureUrl: null as string | null };

vi.mock('@/features/staff/hooks/useStaff', () => ({
  useStaffMe: () => ({ data: { signatureUrl: state.signatureUrl } }),
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
});
afterEach(() => cleanup());

describe('SignatureSection', () => {
  it('mostra o vazio e o botão de configurar quando não há assinatura', () => {
    render(<SignatureSection />);
    expect(screen.getByText('Nenhuma assinatura configurada.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Configurar assinatura/ })).toBeInTheDocument();
  });

  it('mostra a imagem e o botão de redesenhar quando há assinatura', () => {
    state.signatureUrl = 'https://cdn/sig.png';
    render(<SignatureSection />);
    const img = screen.getByAltText('Sua assinatura') as HTMLImageElement;
    expect(img.src).toContain('https://cdn/sig.png');
    expect(screen.getByRole('button', { name: /Redesenhar/ })).toBeInTheDocument();
  });

  it('o botão abre o diálogo de assinatura', () => {
    render(<SignatureSection />);
    expect(screen.queryByTestId('signature-dialog')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: /Configurar assinatura/ }));
    expect(screen.getByTestId('signature-dialog')).toBeInTheDocument();
  });
});
