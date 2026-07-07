import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

vi.mock('@/lib/api', () => ({
  api: {
    residents: { checkImportConflict: vi.fn(), commitImport: vi.fn() },
    houses: { list: vi.fn() },
  },
}));

import { api } from '@/lib/api';
import { renderWithClient } from '@/test/utils';
import { ImportQueue } from './ImportQueue';
import type { ImportQueueItem } from '../../hooks/useBulkImport';
import type { ImportItemStatus } from '../../constants';

function item(id: string, status: ImportItemStatus, name?: string): ImportQueueItem {
  const hasPreview = status === 'ready' || status === 'imported' || (status === 'cancelled' && !!name);
  return {
    id,
    fileName: `${id}.docx`,
    status,
    error: status === 'error' ? 'Falhou' : null,
    preview: hasPreview
      ? ({
          resident: { name: name ?? id },
          relatives: [{ name: 'Mãe', phone: '1', relationship: 'Mãe' }],
          warnings: {},
          houseName: 'Casa A',
          rawText: '',
          photoBase64: null,
          matchedHouseName: 'Casa A',
          contributionMonths: [],
          matchStatus: 'matched',
        } as never)
      : null,
  } as ImportQueueItem;
}

async function openTab(name: RegExp | string) {
  await userEvent.click(screen.getByRole('tab', { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.residents.checkImportConflict).mockResolvedValue({ conflicts: [] } as never);
  vi.mocked(api.houses.list).mockResolvedValue([{ id: 'h1', name: 'Casa A' }] as never);
});
afterEach(() => cleanup());

describe('ImportQueue', () => {
  it('fila totalmente vazia mostra a instrução de arrastar fichas', () => {
    renderWithClient(<ImportQueue items={[]} onRemove={vi.fn()} />);
    expect(screen.getByText('Arraste as fichas .docx para começar')).toBeInTheDocument();
    expect(screen.queryByRole('tab')).not.toBeInTheDocument();
  });

  it('renderiza as 4 abas com os badges de contagem por grupo de status', () => {
    renderWithClient(
      <ImportQueue
        items={[
          item('q', 'queued'),
          item('p', 'processing'),
          item('r', 'ready', 'Pronto'),
          item('e', 'error'),
          item('i', 'imported', 'Aprovado'),
          item('c', 'cancelled', 'Cancelado'),
        ]}
        onRemove={vi.fn()}
      />,
    );
    // Fila = queued + processing → 2
    expect(within(screen.getByRole('tab', { name: /Fila/ })).getByText('2')).toBeInTheDocument();
    // Processadas = ready + error → 2
    expect(
      within(screen.getByRole('tab', { name: /Processadas/ })).getByText('2'),
    ).toBeInTheDocument();
    // Aprovadas = imported → 1
    expect(
      within(screen.getByRole('tab', { name: /Aprovadas/ })).getByText('1'),
    ).toBeInTheDocument();
    // Canceladas = cancelled → 1
    expect(
      within(screen.getByRole('tab', { name: /Canceladas/ })).getByText('1'),
    ).toBeInTheDocument();
  });

  it('a aba Fila é a ativa por padrão e lista só queued/processing', () => {
    renderWithClient(
      <ImportQueue
        items={[item('q', 'queued'), item('p', 'processing'), item('r', 'ready', 'Pronto')]}
        onRemove={vi.fn()}
      />,
    );
    expect(screen.getByText('q.docx')).toBeInTheDocument();
    expect(screen.getByText('p.docx')).toBeInTheDocument();
    // item ready está na aba Processadas, não montado ainda
    expect(screen.queryByText('Pronto')).not.toBeInTheDocument();
  });

  it('cada aba lista apenas os itens do seu grupo', async () => {
    renderWithClient(
      <ImportQueue
        items={[
          item('r', 'ready', 'Ficha Extraída'),
          item('i', 'imported', 'Ficha Aprovada'),
          item('c', 'cancelled', 'Ficha Descartada'),
        ]}
        onRemove={vi.fn()}
      />,
    );
    await openTab(/Processadas/);
    expect(screen.getByText('Ficha Extraída')).toBeInTheDocument();

    await openTab(/Aprovadas/);
    expect(screen.getByText('Ficha Aprovada')).toBeInTheDocument();

    await openTab(/Canceladas/);
    expect(screen.getByText('Ficha Descartada')).toBeInTheDocument();
  });

  it('aba vazia mostra o EmptyState próprio', async () => {
    renderWithClient(<ImportQueue items={[item('q', 'queued')]} onRemove={vi.fn()} />);
    // Fila tem 1 item; Aprovadas está vazia
    await openTab(/Aprovadas/);
    expect(screen.getByText('Nenhuma ficha aprovada.')).toBeInTheDocument();
  });

  it('usa tabCounts quando fornecido para os badges', () => {
    renderWithClient(
      <ImportQueue
        items={[item('q', 'queued')]}
        onRemove={vi.fn()}
        tabCounts={{ queue: 7, processed: 0, approved: 0, cancelled: 0 }}
      />,
    );
    expect(within(screen.getByRole('tab', { name: /Fila/ })).getByText('7')).toBeInTheDocument();
  });

  it('propaga o conflito de sessão calculado para o card na aba Processadas', async () => {
    const sessionConflictName = (it: ImportQueueItem) =>
      it.id === 'r' ? 'Filho Já Importado' : null;
    renderWithClient(
      <ImportQueue
        items={[item('r', 'ready', 'João')]}
        onRemove={vi.fn()}
        onViewFicha={vi.fn()}
        onImported={vi.fn()}
        sessionConflictName={sessionConflictName}
      />,
    );
    await openTab(/Processadas/);
    expect(screen.getByText('Já importado nesta sessão.')).toBeInTheDocument();
  });
});
