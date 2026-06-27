import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { ContributionSummaryCards } from './ContributionSummaryCards';

afterEach(() => cleanup());

describe('ContributionSummaryCards', () => {
  it('renderiza os cinco cards com contagens e valores em BRL', () => {
    render(
      <ContributionSummaryCards
        totalResidents={12}
        totalPaid={9}
        totalPending={3}
        totalExpectedAmount={1000}
        totalCollectedAmount={750.5}
      />,
    );
    expect(screen.getByText('Total de Filhos')).toBeInTheDocument();
    expect(screen.getByText('12')).toBeInTheDocument();
    expect(screen.getByText('9')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?1\.000,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?750,50/)).toBeInTheDocument();
  });
});
