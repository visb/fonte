import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const mutate = vi.fn();

vi.mock('../../hooks/useHouseMinistries', () => ({
  useRemoveMinistry: () => ({ mutate }),
}));

import { RemoveMinistryDialog } from './RemoveMinistryDialog';

const ministry = { id: 'm1', name: 'Cozinha' } as never;

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('RemoveMinistryDialog', () => {
  it('não renderiza quando ministry é null', () => {
    render(<RemoveMinistryDialog ministry={null} houseId="h1" onClose={vi.fn()} />);
    expect(screen.queryByText('Remover ministério')).not.toBeInTheDocument();
  });

  it('mostra confirmação com o nome do ministério', () => {
    render(<RemoveMinistryDialog ministry={ministry} houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByText('Remover ministério')).toBeInTheDocument();
    expect(screen.getByText('Cozinha')).toBeInTheDocument();
  });

  it('confirmar remove pelo id e fecha no sucesso', () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_id, opts) => opts.onSuccess());
    render(<RemoveMinistryDialog ministry={ministry} houseId="h1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(mutate).toHaveBeenCalledWith('m1', expect.anything());
    expect(onClose).toHaveBeenCalled();
  });
});
