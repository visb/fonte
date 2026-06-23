import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';
import { ServantRank } from '@fonte/types';
import type { Resident } from '@fonte/api-client';

const navigate = vi.fn();
vi.mock('react-router-dom', () => ({ useNavigate: () => navigate }));

const promoteMutate = vi.fn();
let promoteState = { isPending: false, isError: false, error: null as unknown };

vi.mock('@/features/houses/hooks/useHouses', () => ({
  useHouses: () => ({ data: [{ id: 'h1', name: 'Casa Belém' }, { id: 'h2', name: 'Casa Nazaré' }] }),
}));
vi.mock('../hooks/useResidents', () => ({
  usePromoteResidentToServant: () => ({ mutate: promoteMutate, ...promoteState }),
}));

import { PromoteToServantDialog } from './PromoteToServantDialog';

function resident(overrides: Partial<Resident> = {}): Resident {
  return { id: 'res1', name: 'Filho A', houseId: 'h1', userId: null, ...overrides } as Resident;
}

beforeEach(() => {
  vi.clearAllMocks();
  promoteState = { isPending: false, isError: false, error: null };
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
});
afterEach(() => cleanup());

describe('PromoteToServantDialog', () => {
  it('sem acesso digital: mostra campos de e-mail/senha', () => {
    render(<PromoteToServantDialog open onClose={vi.fn()} resident={resident()} />);
    expect(screen.getByText('Filho A')).toBeInTheDocument();
    expect(screen.getByLabelText('E-mail')).toBeInTheDocument();
    expect(screen.getByText('Senha gerada')).toBeInTheDocument();
  });

  it('com acesso digital: oculta e-mail e mostra aviso de reaproveitamento', () => {
    render(<PromoteToServantDialog open onClose={vi.fn()} resident={resident({ userId: 'u1' })} />);
    expect(screen.queryByLabelText('E-mail')).not.toBeInTheDocument();
    expect(screen.getByText(/login atual será reaproveitado/)).toBeInTheDocument();
  });

  it('submit válido muta com casa/rank/data e senha (sem acesso) e navega no sucesso', async () => {
    promoteMutate.mockImplementation((_data, opts) => opts.onSuccess({ id: 'staff9' }));
    render(<PromoteToServantDialog open onClose={vi.fn()} resident={resident()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tornar Servo' }));
    await waitFor(() => expect(promoteMutate).toHaveBeenCalled());
    const arg = promoteMutate.mock.calls[0][0];
    expect(arg.houseId).toBe('h1');
    expect(arg.rank).toBe(ServantRank.ASPIRANTE);
    expect(typeof arg.password).toBe('string');
    expect(navigate).toHaveBeenCalledWith('/staff/staff9');
  });

  it('com acesso digital não envia senha no payload', async () => {
    promoteMutate.mockImplementation((_data, opts) => opts.onSuccess({ id: 'staff9' }));
    render(<PromoteToServantDialog open onClose={vi.fn()} resident={resident({ userId: 'u1' })} />);
    fireEvent.click(screen.getByRole('button', { name: 'Tornar Servo' }));
    await waitFor(() => expect(promoteMutate).toHaveBeenCalled());
    expect(promoteMutate.mock.calls[0][0].password).toBeUndefined();
  });

  it('pending desabilita o submit', () => {
    promoteState = { isPending: true, isError: false, error: null };
    render(<PromoteToServantDialog open onClose={vi.fn()} resident={resident()} />);
    expect(screen.getByRole('button', { name: 'Promovendo...' })).toBeDisabled();
  });
});
