import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: { residents: { checkImportConflict: vi.fn() } },
}));

import { api } from '@/lib/api';
import { renderWithClient } from '@/test/utils';
import { ImportItemCard } from './ImportItemCard';
import type { ImportQueueItem } from '../../hooks/useBulkImport';

function readyItem(over: Partial<ImportQueueItem> = {}): ImportQueueItem {
  return {
    id: 'i1',
    fileName: 'ficha.docx',
    status: 'ready',
    error: null,
    preview: {
      resident: { name: 'João Silva', cpf: '12345678900', entryDate: '2023-02-10', exitDate: null },
      relatives: [],
      warnings: {},
      houseName: 'Casa A',
      rawText: '',
      photoBase64: 'data:image/png;base64,abc',
      matchedHouseName: 'Casa A',
      contributionMonths: [],
      matchStatus: 'matched',
    },
    ...over,
  } as ImportQueueItem;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.residents.checkImportConflict).mockResolvedValue({ conflicts: [] } as never);
});
afterEach(() => cleanup());

describe('ImportItemCard', () => {
  it('renderiza foto, entrada e casa (interno sem saída)', () => {
    renderWithClient(<ImportItemCard item={readyItem()} onRemove={vi.fn()} />);
    expect(screen.getByRole('img')).toHaveAttribute('src', 'data:image/png;base64,abc');
    expect(screen.getByText(/Entrada:/)).toHaveTextContent('10/02/2023');
    expect(screen.getByText('Casa A')).toBeInTheDocument();
    expect(screen.getByText('João Silva')).toBeInTheDocument();
    expect(screen.getByText('Sem alertas')).toBeInTheDocument();
  });

  it('mostra saída e esconde a casa atual quando há exitDate', () => {
    const item = readyItem();
    (item.preview!.resident as Record<string, unknown>).exitDate = '2024-06-01';
    renderWithClient(<ImportItemCard item={item} onRemove={vi.fn()} />);
    expect(screen.getByText(/Saída:/)).toHaveTextContent('01/06/2024');
    expect(screen.queryByText('Casa A')).not.toBeInTheDocument();
  });

  it('mostra "N alertas" a partir de warnings', () => {
    const item = readyItem();
    item.preview!.warnings = { cpf: 'CPF ilegível', birthDate: 'Data ausente', empty: '' };
    renderWithClient(<ImportItemCard item={item} onRemove={vi.fn()} />);
    // dois warnings preenchidos (empty é ignorado)
    expect(screen.getByText('2 alertas')).toBeInTheDocument();
  });

  it('mostra badge de conflito quando a checagem retorna conflito', async () => {
    vi.mocked(api.residents.checkImportConflict).mockResolvedValue({
      conflicts: [{ id: 'r9', name: 'João Duplicado', cpf: '12345678900', status: 'ACTIVE', houseName: 'Casa A' }],
    } as never);
    renderWithClient(<ImportItemCard item={readyItem()} onRemove={vi.fn()} />);
    await waitFor(() =>
      expect(screen.getByText(/Conflito: João Duplicado/)).toBeInTheDocument(),
    );
    expect(api.residents.checkImportConflict).toHaveBeenCalledWith('João Silva', '12345678900');
  });

  it('exibe erro e não dispara checagem de conflito', () => {
    renderWithClient(
      <ImportItemCard
        item={readyItem({ status: 'error', error: 'Falhou', preview: null })}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('Falhou')).toBeInTheDocument();
    expect(api.residents.checkImportConflict).not.toHaveBeenCalled();
  });

  it('placeholder de foto quando não há photoBase64', () => {
    const item = readyItem();
    item.preview!.photoBase64 = null;
    renderWithClient(<ImportItemCard item={item} onRemove={vi.fn()} />);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('dispara remover, aprovar e ver ficha', () => {
    const onRemove = vi.fn();
    const onApprove = vi.fn();
    const onViewFicha = vi.fn();
    renderWithClient(
      <ImportItemCard item={readyItem()} onRemove={onRemove} onApprove={onApprove} onViewFicha={onViewFicha} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    fireEvent.click(screen.getByRole('button', { name: 'Ver ficha' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(onApprove).toHaveBeenCalled();
    expect(onViewFicha).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalledWith('i1');
  });

  it('estado processing mostra o rótulo e usa o nome do arquivo', () => {
    renderWithClient(
      <ImportItemCard
        item={readyItem({ status: 'processing', preview: null })}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('Processando...')).toBeInTheDocument();
    expect(screen.getByText('ficha.docx')).toBeInTheDocument();
  });
});
