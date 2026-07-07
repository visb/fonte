import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, fireEvent, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: {
    residents: { checkImportConflict: vi.fn(), commitImport: vi.fn() },
    houses: { list: vi.fn() },
  },
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
      relatives: [{ name: 'Maria', phone: '119', relationship: 'Mãe' }],
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
  vi.mocked(api.houses.list).mockResolvedValue([{ id: 'h1', name: 'Casa A' }] as never);
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
    expect(screen.getByText('2 alertas')).toBeInTheDocument();
  });

  it('sem alertas não vira gatilho de popover', () => {
    renderWithClient(<ImportItemCard item={readyItem()} onRemove={vi.fn()} />);
    const summary = screen.getByText('Sem alertas');
    expect(summary.closest('button')).toBeNull();
    expect(screen.queryByText(/precisam de revisão manual/)).not.toBeInTheDocument();
  });

  it('com alertas, o resumo abre popover listando campo → mensagem', async () => {
    const item = readyItem();
    item.preview!.warnings = {
      entryDate: 'ficha=2023-02-10, planilha=2023-03-01',
      cpf: 'CPF ilegível',
    };
    renderWithClient(<ImportItemCard item={item} onRemove={vi.fn()} />);

    const trigger = screen.getByRole('button', { name: /2 alertas/ });
    expect(screen.queryByText(/precisam de revisão manual/)).not.toBeInTheDocument();

    fireEvent.click(trigger);

    await waitFor(() =>
      expect(screen.getByText(/precisam de revisão manual/)).toBeInTheDocument(),
    );
    expect(screen.getByText('Data de entrada:')).toBeInTheDocument();
    expect(screen.getByText(/ficha=2023-02-10, planilha=2023-03-01/)).toBeInTheDocument();
    expect(screen.getByText('CPF:')).toBeInTheDocument();
    expect(screen.getByText('CPF ilegível')).toBeInTheDocument();
  });

  it('mostra badge de conflito e desabilita Aprovar quando há conflito', async () => {
    vi.mocked(api.residents.checkImportConflict).mockResolvedValue({
      conflicts: [{ id: 'r9', name: 'João Duplicado', cpf: '12345678900', status: 'ACTIVE', houseName: 'Casa A' }],
    } as never);
    renderWithClient(<ImportItemCard item={readyItem()} onRemove={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/Conflito: João Duplicado/)).toBeInTheDocument());
    expect(api.residents.checkImportConflict).toHaveBeenCalledWith('João Silva', '12345678900');
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeDisabled();
  });

  it('desabilita Aprovar e mostra badge quando há conflito de sessão', () => {
    renderWithClient(
      <ImportItemCard item={readyItem()} onRemove={vi.fn()} sessionConflictName="João Silva" />,
    );
    expect(screen.getByText('Já importado nesta sessão.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Aprovar' })).toBeDisabled();
  });

  it('exibe erro e não dispara checagem de conflito', () => {
    renderWithClient(
      <ImportItemCard item={readyItem({ status: 'error', error: 'Falhou', preview: null })} onRemove={vi.fn()} />,
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

  it('Aprovar dispara o commit e marca imported no sucesso', async () => {
    vi.mocked(api.residents.commitImport).mockResolvedValue({
      resident: { id: 'r1' },
      contributionsCreated: { created: 0, skipped: 0 },
    } as never);
    const onImported = vi.fn();
    renderWithClient(<ImportItemCard item={readyItem()} onRemove={vi.fn()} onImported={onImported} />);
    // aguarda a checagem de conflito liberar o botão
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprovar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(onImported).toHaveBeenCalledWith('i1'));
    const payload = vi.mocked(api.residents.commitImport).mock.calls[0][0];
    expect(payload.resident.houseId).toBe('h1');
    expect(payload.relatives).toHaveLength(1);
  });

  it('mostra a mensagem de erro quando o commit falha', async () => {
    vi.mocked(api.residents.commitImport).mockRejectedValue({
      response: { data: { message: 'falha no commit' } },
    });
    renderWithClient(<ImportItemCard item={readyItem()} onRemove={vi.fn()} onImported={vi.fn()} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Aprovar' })).toBeEnabled());
    fireEvent.click(screen.getByRole('button', { name: 'Aprovar' }));
    await waitFor(() => expect(screen.getByText('falha no commit')).toBeInTheDocument());
  });

  it('Ver ficha dispara onViewFicha e Remover dispara onRemove', () => {
    const onViewFicha = vi.fn();
    const onRemove = vi.fn();
    renderWithClient(<ImportItemCard item={readyItem()} onRemove={onRemove} onViewFicha={onViewFicha} />);
    fireEvent.click(screen.getByRole('button', { name: 'Ver ficha' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(onViewFicha).toHaveBeenCalled();
    expect(onRemove).toHaveBeenCalledWith('i1');
  });

  it('estado imported esconde os botões de ação e mostra o badge', () => {
    renderWithClient(<ImportItemCard item={readyItem({ status: 'imported' })} onRemove={vi.fn()} />);
    expect(screen.getByText('Importado')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver ficha' })).not.toBeInTheDocument();
  });

  it('estado processing mostra o rótulo e usa o nome do arquivo', () => {
    renderWithClient(
      <ImportItemCard item={readyItem({ status: 'processing', preview: null })} onRemove={vi.fn()} />,
    );
    expect(screen.getByText('Processando...')).toBeInTheDocument();
    expect(screen.getByText('ficha.docx')).toBeInTheDocument();
  });

  it('estado cancelled troca Remover por Restaurar e esconde a aprovação (story 109)', () => {
    const onRestore = vi.fn();
    renderWithClient(
      <ImportItemCard
        item={readyItem({ status: 'cancelled' })}
        onRemove={vi.fn()}
        onRestore={onRestore}
      />,
    );
    expect(screen.getByText('Cancelado')).toBeInTheDocument();
    // aprovação e ver ficha somem; remover vira restaurar
    expect(screen.queryByRole('button', { name: 'Aprovar' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ver ficha' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remover' })).not.toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Restaurar' }));
    expect(onRestore).toHaveBeenCalledWith('i1');
  });

  it('estado cancelled não dispara checagem de conflito', () => {
    renderWithClient(
      <ImportItemCard item={readyItem({ status: 'cancelled' })} onRemove={vi.fn()} onRestore={vi.fn()} />,
    );
    expect(api.residents.checkImportConflict).not.toHaveBeenCalled();
  });
});
