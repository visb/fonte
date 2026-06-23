import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { AssociatesOverviewCurrent } from '@fonte/api-client';
import { OverviewIndicesCards } from './OverviewIndicesCards';

function current(over: Partial<AssociatesOverviewCurrent> = {}): AssociatesOverviewCurrent {
  return {
    newAssociates: 7,
    activeSubscriptions: 42,
    recurrenceRate: 0.85,
    churnCount: 3,
    churnRate: 0.05,
    delinquentCharges: 2,
    pastDueAssociates: 1,
    ...over,
  } as AssociatesOverviewCurrent;
}

afterEach(() => cleanup());

describe('OverviewIndicesCards', () => {
  it('renderiza os quatro índices do mês', () => {
    render(<OverviewIndicesCards current={current()} />);
    expect(screen.getByText('Novos associados')).toBeInTheDocument();
    expect(screen.getByText('Ativos / recorrência')).toBeInTheDocument();
    expect(screen.getByText('Churn')).toBeInTheDocument();
    expect(screen.getByText('Inadimplência')).toBeInTheDocument();
  });

  it('mostra os valores numéricos e percentuais formatados', () => {
    render(<OverviewIndicesCards current={current()} />);
    expect(screen.getByText('7')).toBeInTheDocument();
    expect(screen.getByText('42')).toBeInTheDocument();
    expect(screen.getByText(/85%\s+dos não-cancelados/)).toBeInTheDocument();
    expect(screen.getByText(/5%\s+no mês/)).toBeInTheDocument();
    expect(screen.getByText(/1 associado\(s\) em atraso/)).toBeInTheDocument();
  });
});
