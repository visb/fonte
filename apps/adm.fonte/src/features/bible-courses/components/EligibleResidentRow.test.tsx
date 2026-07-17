import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { EligibleResident } from '@fonte/api-client';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));

import { EligibleResidentRow } from './EligibleResidentRow';

function resident(overrides: Partial<EligibleResident> = {}): EligibleResident {
  return {
    id: 'r1',
    name: 'Filho A',
    photoThumbUrl: null,
    entryDate: '2020-01-01',
    monthsInTreatment: 5,
    houseId: 'h1',
    houseName: 'Casa Belém',
    ...overrides,
  };
}

/** Props obrigatórias que cada caso pode sobrescrever. */
function renderRow(over: Partial<Parameters<typeof EligibleResidentRow>[0]> = {}) {
  return render(
    <EligibleResidentRow
      resident={resident()}
      checked
      onToggle={vi.fn()}
      onMarkExternal={vi.fn()}
      {...over}
    />,
  );
}

afterEach(() => cleanup());

describe('EligibleResidentRow', () => {
  it('mostra nome, casa e tempo de casa (plural)', () => {
    renderRow();
    expect(screen.getByText('Filho A')).toBeInTheDocument();
    expect(screen.getByText(/Casa Belém · 5 meses de casa/)).toBeInTheDocument();
  });

  it('usa singular para 1 mês', () => {
    renderRow({ resident: resident({ monthsInTreatment: 1 }) });
    expect(screen.getByText(/1 mês de casa/)).toBeInTheDocument();
  });

  it('reflete o estado do checkbox e dispara onToggle', () => {
    const onToggle = vi.fn();
    renderRow({ onToggle });
    const box = screen.getByRole('checkbox') as HTMLInputElement;
    expect(box.checked).toBe(true);
    fireEvent.click(box);
    expect(onToggle).toHaveBeenCalledWith('r1');
  });

  it('checkbox tem aria-label com o nome do filho (sem <label> de wrapper)', () => {
    renderRow({ checked: false });
    const box = screen.getByRole('checkbox', { name: 'Selecionar Filho A' });
    expect(box).toBeInTheDocument();
    expect((box as HTMLInputElement).checked).toBe(false);
  });

  it('clicar no nome chama onToggle com o id', () => {
    const onToggle = vi.fn();
    renderRow({ onToggle });
    fireEvent.click(screen.getByText('Filho A'));
    expect(onToggle).toHaveBeenCalledWith('r1');
  });

  it('clicar na foto chama onToggle com o id', () => {
    const onToggle = vi.fn();
    renderRow({ resident: resident({ photoThumbUrl: 'thumb.jpg' }), onToggle });
    fireEvent.click(screen.getByAltText('Filho A'));
    expect(onToggle).toHaveBeenCalledWith('r1');
  });

  it('renderiza link para a ficha do filho em nova aba', () => {
    renderRow();
    const link = screen.getByRole('link', { name: 'Abrir ficha de Filho A em nova aba' });
    expect(link).toHaveAttribute('href', '/residents/r1');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link.getAttribute('rel')).toContain('noopener');
  });

  it('clicar no link NÃO chama onToggle (o <label> de wrapper saiu)', () => {
    const onToggle = vi.fn();
    renderRow({ onToggle });
    fireEvent.click(screen.getByRole('link', { name: 'Abrir ficha de Filho A em nova aba' }));
    expect(onToggle).not.toHaveBeenCalled();
  });

  it('renderiza a foto quando há thumbnail', () => {
    renderRow({ resident: resident({ photoThumbUrl: 'thumb.jpg' }) });
    expect(screen.getByAltText('Filho A')).toHaveAttribute('src', 'thumb.jpg');
  });
});

// Story 127: "já fez" é o único jeito de tirar da sugestão quem concluiu o
// curso antes do sistema existir.
describe('EligibleResidentRow — ação "já fez" (story 127)', () => {
  it('o botão nomeia o filho para leitor de tela', () => {
    renderRow();
    expect(
      screen.getByRole('button', { name: 'Marcar Filho A como já fez o curso' }),
    ).toBeInTheDocument();
  });

  it('clicar em "já fez" chama onMarkExternal com o id', () => {
    const onMarkExternal = vi.fn();
    renderRow({ onMarkExternal });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar Filho A como já fez o curso' }));
    expect(onMarkExternal).toHaveBeenCalledWith('r1');
  });

  // Mesma regressão do link (story 125): a ação fica fora da área clicável, então
  // marcar "já fez" não pode alternar o checkbox de seleção por tabela.
  it('clicar em "já fez" NÃO chama onToggle', () => {
    const onToggle = vi.fn();
    renderRow({ onToggle });
    fireEvent.click(screen.getByRole('button', { name: 'Marcar Filho A como já fez o curso' }));
    expect(onToggle).not.toHaveBeenCalled();
  });
});
