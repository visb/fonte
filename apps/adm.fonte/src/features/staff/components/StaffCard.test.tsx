import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { Role, ServantRank } from '@fonte/types';
import type { Staff } from '@fonte/api-client';

vi.mock('@/lib/api', () => ({ api: { photoUrl: (u: string | null) => u } }));

import { StaffCard } from './StaffCard';

function makeStaff(overrides: Partial<Staff> = {}): Staff {
  return {
    id: 's1',
    name: 'Pedro Servo',
    photoUrl: null,
    whatsapp: '62999998888',
    rank: ServantRank.ASPIRANTE,
    house: { id: 'h1', name: 'Casa Belém' },
    user: { email: 'pedro@x.com', role: Role.SERVANT },
    ...overrides,
  } as Staff;
}

const noop = () => {};

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('StaffCard', () => {
  it('mostra nome, casa, e-mail, whatsapp mascarado e badge de papel', () => {
    render(
      <StaffCard staff={makeStaff()} onView={noop} onEdit={noop} onResetPassword={noop} onDelete={noop} />,
    );
    expect(screen.getByText('Pedro Servo')).toBeInTheDocument();
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
    expect(screen.getByText('pedro@x.com')).toBeInTheDocument();
    // Story 97 — persistimos só dígitos; a exibição aplica a máscara.
    expect(screen.getByText('(62) 99999-8888')).toBeInTheDocument();
    expect(screen.getByText('Servo')).toBeInTheDocument();
  });

  it('mostra o rank apenas para SERVANT', () => {
    const { rerender } = render(
      <StaffCard staff={makeStaff()} onView={noop} onEdit={noop} onResetPassword={noop} onDelete={noop} />,
    );
    expect(screen.getByText('Aspirante')).toBeInTheDocument();

    rerender(
      <StaffCard
        staff={makeStaff({ user: { email: 'a@x.com', role: Role.ADMIN } as Staff['user'] })}
        onView={noop}
        onEdit={noop}
        onResetPassword={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.queryByText('Aspirante')).not.toBeInTheDocument();
  });

  it('dispara os callbacks dos botões', async () => {
    const onView = vi.fn();
    const onEdit = vi.fn();
    const onReset = vi.fn();
    const onDelete = vi.fn();
    render(
      <StaffCard staff={makeStaff()} onView={onView} onEdit={onEdit} onResetPassword={onReset} onDelete={onDelete} />,
    );
    screen.getByText('Pedro Servo').click();
    screen.getByTitle('Editar').click();
    screen.getByTitle('Resetar senha').click();
    screen.getByTitle('Excluir').click();
    expect(onView).toHaveBeenCalled();
    expect(onEdit).toHaveBeenCalled();
    expect(onReset).toHaveBeenCalled();
    expect(onDelete).toHaveBeenCalled();
  });

  it('renderiza foto quando há photoUrl', () => {
    render(
      <StaffCard
        staff={makeStaff({ photoUrl: 'http://img/p.jpg', house: null })}
        onView={noop}
        onEdit={noop}
        onResetPassword={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByRole('img')).toHaveAttribute('src', 'http://img/p.jpg');
  });
});
