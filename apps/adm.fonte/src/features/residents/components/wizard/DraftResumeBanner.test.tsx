import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { DraftResumeBanner } from './DraftResumeBanner';
import { DraftSavedIndicator } from './DraftSavedIndicator';
import { DiscardDraftDialog } from './DiscardDraftDialog';

afterEach(() => cleanup());

const SAVED_AT = '2026-10-17T17:05:00Z'; // 14:05 em São Paulo

describe('DraftResumeBanner', () => {
  it('mostra o nome e a data/hora do rascunho', () => {
    render(<DraftResumeBanner name="Fulano" savedAt={SAVED_AT} onContinue={vi.fn()} onDiscard={vi.fn()} />);
    const banner = screen.getByRole('region', { name: 'Rascunho de acolhimento' });
    expect(banner).toHaveTextContent('Há um acolhimento não concluído de Fulano');
    expect(banner).toHaveTextContent('17/10/2026 14:05');
  });

  it('sem nome mostra "sem nome"', () => {
    render(<DraftResumeBanner name="  " savedAt={SAVED_AT} onContinue={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByText('sem nome')).toBeInTheDocument();
  });

  it('nome ausente também mostra "sem nome"', () => {
    render(<DraftResumeBanner savedAt={SAVED_AT} onContinue={vi.fn()} onDiscard={vi.fn()} />);
    expect(screen.getByText('sem nome')).toBeInTheDocument();
  });

  it('Continuar e Descartar chamam os callbacks', () => {
    const onContinue = vi.fn();
    const onDiscard = vi.fn();
    render(<DraftResumeBanner name="Fulano" savedAt={SAVED_AT} onContinue={onContinue} onDiscard={onDiscard} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Descartar' }));
    expect(onContinue).toHaveBeenCalledTimes(1);
    expect(onDiscard).toHaveBeenCalledTimes(1);
  });
});

describe('DraftSavedIndicator', () => {
  it('mostra a hora do último salvamento', () => {
    render(<DraftSavedIndicator savedAt={SAVED_AT} />);
    expect(screen.getByText('Rascunho salvo às 14:05')).toBeInTheDocument();
  });

  it('sem salvamento não renderiza nada', () => {
    const { container } = render(<DraftSavedIndicator savedAt={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('DiscardDraftDialog', () => {
  it('confirmar chama onConfirm; fechado não aparece', () => {
    const onConfirm = vi.fn();
    const { rerender } = render(<DiscardDraftDialog open={false} onOpenChange={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.queryByText('Cancelar acolhimento?')).not.toBeInTheDocument();
    rerender(<DiscardDraftDialog open onOpenChange={vi.fn()} onConfirm={onConfirm} />);
    expect(screen.getByText('Cancelar acolhimento?')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Descartar e sair' }));
    expect(onConfirm).toHaveBeenCalled();
  });

  it('"Continuar preenchendo" fecha sem confirmar', () => {
    const onConfirm = vi.fn();
    const onOpenChange = vi.fn();
    render(<DiscardDraftDialog open onOpenChange={onOpenChange} onConfirm={onConfirm} />);
    fireEvent.click(screen.getByRole('button', { name: 'Continuar preenchendo' }));
    expect(onOpenChange).toHaveBeenCalledWith(false);
    expect(onConfirm).not.toHaveBeenCalled();
  });
});
