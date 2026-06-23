import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { PayablesSummary } from '@fonte/api-client';
import { PayablesSummaryCards } from './PayablesSummaryCards';

function summary(over: Partial<PayablesSummary> = {}): PayablesSummary {
  return {
    totalOpen: 150000,
    countOpen: 3,
    totalOverdue: 50000,
    countOverdue: 1,
    totalPaid: 200000,
    countPaid: 5,
    ...over,
  } as PayablesSummary;
}

afterEach(() => cleanup());

describe('PayablesSummaryCards', () => {
  it('mostra os três cards com rótulos e totais formatados', () => {
    render(<PayablesSummaryCards summary={summary()} />);
    expect(screen.getByText('A pagar (em aberto)')).toBeInTheDocument();
    expect(screen.getByText('Vencidas')).toBeInTheDocument();
    expect(screen.getByText('Pagas')).toBeInTheDocument();
    // 150000 centavos = R$ 1.500,00
    expect(screen.getByText(/1\.500,00/)).toBeInTheDocument();
    expect(screen.getByText(/2\.000,00/)).toBeInTheDocument();
  });

  it('singulariza "conta" quando há exatamente uma', () => {
    render(<PayablesSummaryCards summary={summary({ countOverdue: 1 })} />);
    expect(screen.getByText('1 conta')).toBeInTheDocument();
  });

  it('pluraliza "contas" quando há mais de uma', () => {
    render(<PayablesSummaryCards summary={summary({ countPaid: 5 })} />);
    expect(screen.getByText('5 contas')).toBeInTheDocument();
  });

  it('mostra "0 contas" quando não há contas', () => {
    render(<PayablesSummaryCards summary={summary({ countOpen: 0, totalOpen: 0 })} />);
    expect(screen.getByText('0 contas')).toBeInTheDocument();
  });
});
