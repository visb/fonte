import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { StreetSalesReportByHouse } from '@fonte/api-client';
import { SalesByHouseTable } from './SalesByHouseTable';

const rows = [
  {
    houseId: 'h1',
    houseName: 'Casa Um',
    totalQuantity: 3,
    totalPix: 10000,
    totalCash: 5000,
    totalCard: 2500,
    totalAmount: 17500,
  },
] as StreetSalesReportByHouse[];

afterEach(() => cleanup());

describe('SalesByHouseTable', () => {
  it('lista vazia não renderiza nada', () => {
    const { container } = render(<SalesByHouseTable byHouse={[]} />);
    expect(container.firstChild).toBeNull();
  });

  it('renderiza linha com valores formatados em BRL', () => {
    render(<SalesByHouseTable byHouse={rows} />);
    expect(screen.getByText('Casa Um')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?100,00/)).toBeInTheDocument();
    expect(screen.getByText(/R\$\s?175,00/)).toBeInTheDocument();
  });
});
