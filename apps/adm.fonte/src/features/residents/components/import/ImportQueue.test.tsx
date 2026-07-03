import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, screen } from '@testing-library/react';

vi.mock('@/lib/api', () => ({
  api: { residents: { checkImportConflict: vi.fn() } },
}));

import { api } from '@/lib/api';
import { renderWithClient } from '@/test/utils';
import { ImportQueue } from './ImportQueue';
import type { ImportQueueItem } from '../../hooks/useBulkImport';

function queued(id: string): ImportQueueItem {
  return { id, fileName: `${id}.docx`, status: 'queued', preview: null, error: null };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.residents.checkImportConflict).mockResolvedValue({ conflicts: [] } as never);
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
});
