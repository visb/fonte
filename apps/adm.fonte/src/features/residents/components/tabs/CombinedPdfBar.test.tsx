import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';

import { CombinedPdfBar } from './CombinedPdfBar';

type Overrides = Partial<Parameters<typeof CombinedPdfBar>[0]>;

function renderBar(over: Overrides = {}) {
  const onGenerate = vi.fn();
  const onToggleAll = vi.fn();
  render(
    <CombinedPdfBar
      count={0}
      total={3}
      allSelected={false}
      someSelected={false}
      generating={false}
      onGenerate={onGenerate}
      onToggleAll={onToggleAll}
      {...over}
    />,
  );
  return { onGenerate, onToggleAll };
}

const checkbox = () => screen.getByRole('checkbox', { name: 'Selecionar todos os documentos' }) as HTMLInputElement;
const generateButton = () => screen.getByRole('button', { name: /Gerar PDF combinado/ });

afterEach(() => cleanup());

describe('CombinedPdfBar', () => {
  // Story 161, decisão 1 — a barra existe mesmo sem nenhum documento
  // selecionável: esqueleto estável da aba, sem salto de layout.
  it('renderiza com total = 0 e deixa botão e checkbox desabilitados', () => {
    renderBar({ count: 0, total: 0 });
    expect(screen.getByText('Nenhum documento selecionado')).toBeInTheDocument();
    expect(generateButton()).toBeDisabled();
    expect(checkbox()).toBeDisabled();
  });

  it('sem seleção mostra o texto de vazio, botão desabilitado e checkbox limpo', () => {
    renderBar({ count: 0, total: 3 });
    expect(screen.getByText('Nenhum documento selecionado')).toBeInTheDocument();
    expect(generateButton()).toBeDisabled();
    expect(checkbox()).not.toBeChecked();
    expect(checkbox().indeterminate).toBe(false);
    // Com documentos selecionáveis o checkbox segue clicável.
    expect(checkbox()).toBeEnabled();
  });

  it('seleção parcial deixa o checkbox indeterminate e o botão habilitado', () => {
    renderBar({ count: 1, total: 3, someSelected: true, allSelected: false });
    expect(screen.getByText('1 documento selecionado')).toBeInTheDocument();
    // `indeterminate` é PROPRIEDADE do elemento, não atributo do HTML.
    expect(checkbox().indeterminate).toBe(true);
    expect(checkbox()).not.toBeChecked();
    expect(generateButton()).toBeEnabled();
  });

  it('tudo selecionado marca o checkbox e usa o plural', () => {
    renderBar({ count: 3, total: 3, someSelected: true, allSelected: true });
    expect(screen.getByText('3 documentos selecionados')).toBeInTheDocument();
    expect(checkbox()).toBeChecked();
    expect(checkbox().indeterminate).toBe(false);
  });

  it('gerando desabilita botão e checkbox e troca o ícone pelo spinner', () => {
    const { container } = render(
      <CombinedPdfBar
        count={2}
        total={3}
        allSelected={false}
        someSelected
        generating
        onGenerate={vi.fn()}
        onToggleAll={vi.fn()}
      />,
    );
    expect(generateButton()).toBeDisabled();
    expect(checkbox()).toBeDisabled();
    expect(container.querySelector('.animate-spin')).toBeInTheDocument();
  });

  it('clicar no checkbox chama onToggleAll', () => {
    const { onToggleAll } = renderBar({ count: 0, total: 3 });
    fireEvent.click(checkbox());
    expect(onToggleAll).toHaveBeenCalledTimes(1);
  });

  it('clicar em gerar com seleção chama onGenerate', () => {
    const { onGenerate } = renderBar({ count: 2, total: 3, someSelected: true });
    fireEvent.click(generateButton());
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  // Story 161, decisão 3 — o botão saiu de vez; quem desmarca tudo é o checkbox.
  it.each([
    ['sem seleção', { count: 0, total: 3 }],
    ['seleção parcial', { count: 1, total: 3, someSelected: true }],
    ['tudo selecionado', { count: 3, total: 3, someSelected: true, allSelected: true }],
    ['sem documentos', { count: 0, total: 0 }],
    ['gerando', { count: 3, total: 3, someSelected: true, allSelected: true, generating: true }],
  ])('não oferece "Limpar seleção" (%s)', (_caso, over) => {
    renderBar(over as Overrides);
    expect(screen.queryByText('Limpar seleção')).not.toBeInTheDocument();
  });
});
