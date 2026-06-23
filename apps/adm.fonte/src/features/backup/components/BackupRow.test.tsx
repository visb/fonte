import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import type { BackupListItem } from '@fonte/api-client';
import { BackupRow } from './BackupRow';

afterEach(() => cleanup());

function backup(overrides: Partial<BackupListItem> = {}): BackupListItem {
  return {
    key: 'db/2026-06-07T04-00-00-000Z.dump',
    createdAt: '2026-06-07T04:00:00.000Z',
    size: 1048576,
    ...overrides,
  } as BackupListItem;
}

describe('BackupRow', () => {
  it('mostra só o nome do arquivo (após a barra) e tamanho formatado', () => {
    render(<BackupRow backup={backup()} />);
    expect(screen.getByText('2026-06-07T04-00-00-000Z.dump')).toBeInTheDocument();
    expect(screen.getByText(/1\.0 MB/)).toBeInTheDocument();
  });

  it('usa a chave inteira quando não há barra', () => {
    render(<BackupRow backup={backup({ key: 'standalone.dump' })} />);
    expect(screen.getByText('standalone.dump')).toBeInTheDocument();
  });
});
