import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';

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

function queued(id: string): ImportQueueItem {
  return { id, fileName: `${id}.docx`, status: 'queued', preview: null, error: null };
}

function ready(id: string, name: string): ImportQueueItem {
  return {
    id,
    fileName: `${id}.docx`,
    status: 'ready',
    error: null,
    preview: {
      resident: { name },
      relatives: [{ name: 'Mãe', phone: '1', relationship: 'Mãe' }],
      warnings: {},
      houseName: 'Casa A',
      rawText: '',
      photoBase64: null,
      matchedHouseName: 'Casa A',
      contributionMonths: [],
      matchStatus: 'matched',
    },
  } as ImportQueueItem;
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.residents.checkImportConflict).mockResolvedValue({ conflicts: [] } as never);
  vi.mocked(api.houses.list).mockResolvedValue([{ id: 'h1', name: 'Casa A' }] as never);
});
afterEach(() => cleanup());

describe('ImportQueue', () => {
  it('fila vazia mostra o empty state', () => {
    renderWithClient(<ImportQueue items={[]} onRemove={vi.fn()} />);
    expect(screen.getByText('Arraste as fichas .docx para começar')).toBeInTheDocument();
  });

  it('renderiza um card por item', () => {
    renderWithClient(<ImportQueue items={[queued('a'), queued('b')]} onRemove={vi.fn()} />);
    expect(screen.getByText('a.docx')).toBeInTheDocument();
    expect(screen.getByText('b.docx')).toBeInTheDocument();
  });

  it('propaga o conflito de sessão calculado para o card', () => {
    const sessionConflictName = (item: ImportQueueItem) =>
      item.id === 'a' ? 'Filho Já Importado' : null;
    renderWithClient(
      <ImportQueue
        items={[ready('a', 'João')]}
        onRemove={vi.fn()}
        onViewFicha={vi.fn()}
        onImported={vi.fn()}
        sessionConflictName={sessionConflictName}
      />,
    );
    expect(screen.getByText('Já importado nesta sessão.')).toBeInTheDocument();
  });
});
