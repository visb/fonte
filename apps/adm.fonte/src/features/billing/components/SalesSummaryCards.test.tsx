import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { StreetSalesReportResponse } from '@fonte/api-client';
import { SalesSummaryCards } from './SalesSummaryCards';

function data(over: Partial<StreetSalesReportResponse> = {}): StreetSalesReportResponse {
  return {
    currentPeriodTotal: 100000, previousPeriodTotal: 80000,
    byHouse: [
      { totalPix: 40000, totalCash: 30000, totalCard: 30000, totalQuantity: 10 },
    ],
    ...over,
  } as unknown as StreetSalesReportResponse;
}

afterEach(() => cleanup());

describe('SalesSummaryCards', () => {
  it('mostra os quatro cards com totais agregados', () => {
    render(<SalesSummaryCards data={data()} />);
    expect(screen.getByText('Total Arrecadado')).toBeInTheDocument();
    expect(screen.getByText('PIX')).toBeInTheDocument();
    expect(screen.getByText('Dinheiro')).toBeInTheDocument();
    expect(screen.getByText('Cartão')).toBeInTheDocument();
  });

  it('tendência positiva mostra alta percentual', () => {
    render(<SalesSummaryCards data={data({ currentPeriodTotal: 100000, previousPeriodTotal: 80000 })} />);
    expect(screen.getByText(/\+25\.0%/)).toBeInTheDocument();
    expect(screen.getByText('vs mês anterior')).toBeInTheDocument();
  });

  it('tendência negativa mostra queda percentual', () => {
    render(<SalesSummaryCards data={data({ currentPeriodTotal: 60000, previousPeriodTotal: 80000 })} />);
    expect(screen.getByText(/-25\.0%/)).toBeInTheDocument();
  });

  it('sem período anterior não mostra tendência', () => {
    render(<SalesSummaryCards data={data({ previousPeriodTotal: 0 })} />);
    expect(screen.queryByText('vs mês anterior')).not.toBeInTheDocument();
  });
});
