import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import type { Admission } from '@fonte/api-client';

import { ContributionAdmissionSelector } from './ContributionAdmissionSelector';

function admission(over: Partial<Admission>): Admission {
  return {
    id: 'ad1',
    residentId: 'r1',
    houseId: 'h1',
    house: null,
    entryDate: '2026-07-17',
    exitDate: null,
    ...over,
  } as unknown as Admission;
}

// Ordem do backend: índice 0 é o acolhimento atual.
const CURRENT = admission({ id: 'ad-atual', entryDate: '2026-07-17', exitDate: null });
const PREVIOUS = admission({ id: 'ad-antigo', entryDate: '2025-08-01', exitDate: '2026-02-10' });

afterEach(() => cleanup());

describe('ContributionAdmissionSelector', () => {
  it('não renderiza com um acolhimento só', () => {
    const { container } = render(
      <ContributionAdmissionSelector admissions={[CURRENT]} selectedAdmissionId="ad-atual" onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('não renderiza sem acolhimento nenhum', () => {
    const { container } = render(
      <ContributionAdmissionSelector admissions={[]} selectedAdmissionId={null} onChange={vi.fn()} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('numera do mais antigo para o mais recente e marca o vigente com "(atual)"', () => {
    render(
      <ContributionAdmissionSelector
        admissions={[CURRENT, PREVIOUS]}
        selectedAdmissionId="ad-atual"
        onChange={vi.fn()}
      />,
    );

    expect(screen.getByRole('option', { name: 'Acolhimento 2 — 17/07/2026 a em aberto (atual)' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Acolhimento 1 — 01/08/2025 a 10/02/2026' })).toBeInTheDocument();
  });

  it('acolhimento sem data de entrada mostra travessão', () => {
    const semData = admission({ id: 'ad-sem-data', entryDate: null, exitDate: null });
    render(
      <ContributionAdmissionSelector
        admissions={[CURRENT, semData]}
        selectedAdmissionId="ad-atual"
        onChange={vi.fn()}
      />,
    );
    expect(screen.getByRole('option', { name: 'Acolhimento 1 — — a em aberto' })).toBeInTheDocument();
  });

  it('emite o id escolhido no onChange', () => {
    const onChange = vi.fn();
    render(
      <ContributionAdmissionSelector
        admissions={[CURRENT, PREVIOUS]}
        selectedAdmissionId="ad-atual"
        onChange={onChange}
      />,
    );

    fireEvent.change(screen.getByLabelText('Acolhimento'), { target: { value: 'ad-antigo' } });

    expect(onChange).toHaveBeenCalledWith('ad-antigo');
  });
});
