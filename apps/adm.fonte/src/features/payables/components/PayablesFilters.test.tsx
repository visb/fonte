import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { PayableStatus, PayableCategory } from '@fonte/types';
import type { ListPayablesParams } from '@fonte/api-client';
import { PayablesFilters } from './PayablesFilters';

function renderFilters(filters: ListPayablesParams = {}) {
  const onChange = vi.fn();
  render(<PayablesFilters filters={filters} onChange={onChange} />);
  return onChange;
}

afterEach(() => cleanup());

describe('PayablesFilters', () => {
  it('renderiza os quatro filtros', () => {
    renderFilters();
    expect(screen.getByLabelText('Status')).toBeInTheDocument();
    expect(screen.getByLabelText('Categoria')).toBeInTheDocument();
    expect(screen.getByLabelText('Vencimento de')).toBeInTheDocument();
    expect(screen.getByLabelText('Vencimento até')).toBeInTheDocument();
  });

  it('mudar status propaga o valor', () => {
    const onChange = renderFilters();
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: PayableStatus.PAID } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: PayableStatus.PAID }));
  });

  it('mudar categoria propaga o valor', () => {
    const onChange = renderFilters();
    fireEvent.change(screen.getByLabelText('Categoria'), { target: { value: PayableCategory.SUPPLIES } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: PayableCategory.SUPPLIES }));
  });

  it('limpar status manda undefined', () => {
    const onChange = renderFilters({ status: PayableStatus.OPEN });
    fireEvent.change(screen.getByLabelText('Status'), { target: { value: '' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ status: undefined }));
  });

  it('datas de vencimento propagam', () => {
    const onChange = renderFilters();
    // DateInput (story 201): digita dd/mm/aaaa, o filtro recebe YYYY-MM-DD.
    fireEvent.change(screen.getByLabelText('Vencimento de'), { target: { value: '01/01/2026' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-01-01' }));
    fireEvent.change(screen.getByLabelText('Vencimento até'), { target: { value: '31/12/2026' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ to: '2026-12-31' }));
  });

  it('data incompleta não filtra (manda undefined) e o valor salvo aparece formatado', () => {
    const onChange = renderFilters({ from: '2026-03-07' });
    expect(screen.getByLabelText('Vencimento de')).toHaveValue('07/03/2026');
    fireEvent.change(screen.getByLabelText('Vencimento de'), { target: { value: '07/03' } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ from: undefined }));
  });
});
