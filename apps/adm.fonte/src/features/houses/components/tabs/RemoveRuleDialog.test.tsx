import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

const mutate = vi.fn();

vi.mock('../../hooks/useHouseRules', () => ({
  useDeleteRule: () => ({ mutate }),
}));

import { RemoveRuleDialog } from './RemoveRuleDialog';

const rule = { id: 'r1', title: 'Silêncio' } as never;

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('RemoveRuleDialog', () => {
  it('não renderiza quando rule é null', () => {
    render(<RemoveRuleDialog rule={null} houseId="h1" onClose={vi.fn()} />);
    expect(screen.queryByText('Remover regra')).not.toBeInTheDocument();
  });

  it('mostra confirmação com o título da regra', () => {
    render(<RemoveRuleDialog rule={rule} houseId="h1" onClose={vi.fn()} />);
    expect(screen.getByText('Remover regra')).toBeInTheDocument();
    expect(screen.getByText(/Silêncio/)).toBeInTheDocument();
  });

  it('confirmar deleta pelo id e fecha no sucesso', () => {
    const onClose = vi.fn();
    mutate.mockImplementation((_id, opts) => opts.onSuccess());
    render(<RemoveRuleDialog rule={rule} houseId="h1" onClose={onClose} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remover' }));
    expect(mutate).toHaveBeenCalledWith('r1', expect.anything());
    expect(onClose).toHaveBeenCalled();
  });
});
