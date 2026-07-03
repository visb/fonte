import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: { residents: { parseSpreadsheet: vi.fn() } },
}));

import { api } from '@/lib/api';
import { renderWithClient } from '@/test/utils';
import { SpreadsheetUploadStep } from './SpreadsheetUploadStep';
import type { ParseSpreadsheetResult } from '@fonte/api-client';

function file(name: string): File {
  return new File(['x'], name);
}

function meta(over: Partial<ParseSpreadsheetResult> = {}): ParseSpreadsheetResult {
  return { rows: [{ name: 'A' } as never], houses: ['Casa A'], skipped: 0, ignoredSheets: [], ...over };
}

function getInput(container: HTMLElement): HTMLInputElement {
  return container.querySelector('input[type="file"]') as HTMLInputElement;
}

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('SpreadsheetUploadStep', () => {
  it('rejeita arquivo que não é .xlsx sem chamar a API', () => {
    const onParsed = vi.fn();
    const { container } = renderWithClient(<SpreadsheetUploadStep onParsed={onParsed} loaded={null} />);
    fireEvent.change(getInput(container), { target: { files: [file('lista.csv')] } });
    expect(screen.getByText('Apenas planilhas .xlsx são aceitas.')).toBeInTheDocument();
    expect(api.residents.parseSpreadsheet).not.toHaveBeenCalled();
    expect(onParsed).not.toHaveBeenCalled();
  });

  it('aceita .xlsx, chama a API e devolve as rows via onParsed', async () => {
    vi.mocked(api.residents.parseSpreadsheet).mockResolvedValue(meta() as never);
    const onParsed = vi.fn();
    const { container } = renderWithClient(<SpreadsheetUploadStep onParsed={onParsed} loaded={null} />);
    fireEvent.change(getInput(container), { target: { files: [file('lista.xlsx')] } });
    await waitFor(() => expect(onParsed).toHaveBeenCalled());
    expect(api.residents.parseSpreadsheet).toHaveBeenCalledWith(expect.any(FormData));
    expect(onParsed.mock.calls[0][0]).toEqual([{ name: 'A' }]);
  });

  it('mostra erro amigável quando a API falha', async () => {
    vi.mocked(api.residents.parseSpreadsheet).mockRejectedValue({
      response: { data: { message: 'planilha inválida' } },
    });
    const { container } = renderWithClient(<SpreadsheetUploadStep onParsed={vi.fn()} loaded={null} />);
    fireEvent.change(getInput(container), { target: { files: [file('lista.xlsx')] } });
    await waitFor(() => expect(screen.getByText('planilha inválida')).toBeInTheDocument());
  });

  it('drag over/leave e drop de .xlsx acionam o parse', async () => {
    vi.mocked(api.residents.parseSpreadsheet).mockResolvedValue(meta() as never);
    const onParsed = vi.fn();
    renderWithClient(<SpreadsheetUploadStep onParsed={onParsed} loaded={null} />);
    const zone = screen.getByRole('button', { name: 'Área de upload da planilha de referência' });
    fireEvent.click(zone); // abre o seletor de arquivo
    fireEvent.dragOver(zone);
    fireEvent.dragLeave(zone);
    fireEvent.drop(zone, { dataTransfer: { files: [file('lista.xlsx')] } });
    await waitFor(() => expect(onParsed).toHaveBeenCalled());
  });

  it('mostra o estado de carregamento enquanto lê a planilha', async () => {
    vi.mocked(api.residents.parseSpreadsheet).mockReturnValue(new Promise(() => {}) as never);
    const { container } = renderWithClient(<SpreadsheetUploadStep onParsed={vi.fn()} loaded={null} />);
    fireEvent.change(getInput(container), { target: { files: [file('lista.xlsx')] } });
    await waitFor(() => expect(screen.getByText('Lendo a planilha...')).toBeInTheDocument());
  });

  it('estado carregado mostra o resumo e permite trocar a planilha', async () => {
    vi.mocked(api.residents.parseSpreadsheet).mockResolvedValue(meta() as never);
    const onParsed = vi.fn();
    const { container } = renderWithClient(
      <SpreadsheetUploadStep onParsed={onParsed} loaded={meta({ skipped: 2, houses: ['Casa A', 'Casa B'] })} />,
    );
    expect(screen.getByText('Planilha carregada')).toBeInTheDocument();
    expect(screen.getByText(/1 filho\(s\) em 2 casa\(s\)/)).toHaveTextContent('2 linha(s) ignorada(s)');
    // troca a planilha: clica no botão e envia o novo arquivo
    fireEvent.click(screen.getByRole('button', { name: 'Trocar planilha' }));
    fireEvent.change(getInput(container), { target: { files: [file('nova.xlsx')] } });
    await waitFor(() => expect(onParsed).toHaveBeenCalled());
  });
});
