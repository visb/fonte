import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AdmissionWizardFooter } from './AdmissionWizardFooter';

afterEach(() => cleanup());

function renderFooter(overrides: Partial<Parameters<typeof AdmissionWizardFooter>[0]> = {}) {
  const props = {
    step: 0,
    isLast: false,
    advancing: false,
    draftSavedAt: null,
    onCancel: vi.fn(),
    onBack: vi.fn(),
    onNext: vi.fn(),
    onFinish: vi.fn(),
    ...overrides,
  };
  render(<AdmissionWizardFooter {...props} />);
  return props;
}

describe('AdmissionWizardFooter', () => {
  it('no 1º passo mostra Cancelar e Avançar', () => {
    const props = renderFooter();
    fireEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    fireEvent.click(screen.getByRole('button', { name: /Avançar/ }));
    expect(props.onCancel).toHaveBeenCalled();
    expect(props.onNext).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Voltar/ })).not.toBeInTheDocument();
  });

  it('nos passos seguintes mostra Voltar', () => {
    const props = renderFooter({ step: 2 });
    fireEvent.click(screen.getByRole('button', { name: /Voltar/ }));
    expect(props.onBack).toHaveBeenCalled();
  });

  it('no último passo mostra Concluir acolhimento', () => {
    const props = renderFooter({ step: 3, isLast: true });
    fireEvent.click(screen.getByRole('button', { name: /Concluir acolhimento/ }));
    expect(props.onFinish).toHaveBeenCalled();
  });

  it('salvando desabilita e troca os rótulos', () => {
    renderFooter({ step: 1, advancing: true });
    expect(screen.getByRole('button', { name: /Salvando/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: /Voltar/ })).toBeDisabled();
    cleanup();
    renderFooter({ step: 3, isLast: true, advancing: true });
    expect(screen.getByRole('button', { name: /Concluindo/ })).toBeDisabled();
  });

  it('mostra o indicador do rascunho', () => {
    renderFooter({ draftSavedAt: '2026-10-17T17:05:00Z' });
    expect(screen.getByText('Rascunho salvo às 14:05')).toBeInTheDocument();
  });
});
