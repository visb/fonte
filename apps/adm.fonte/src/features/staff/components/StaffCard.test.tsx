import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render as rtlRender, screen, cleanup, fireEvent } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
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

// O card é um <Link> do react-router — precisa de um Router em volta.
const render = (ui: React.ReactElement) => rtlRender(ui, { wrapper: MemoryRouter });

beforeEach(() => vi.clearAllMocks());
afterEach(() => cleanup());

describe('StaffCard', () => {
  it('mostra nome, casa, e-mail, whatsapp mascarado e badge de papel', () => {
    render(
      <StaffCard staff={makeStaff()} href="/staff/s1" onEdit={noop} onResetPassword={noop} onDelete={noop} />,
    );
    expect(screen.getByText('Pedro Servo')).toBeInTheDocument();
    expect(screen.getByText('Casa Belém')).toBeInTheDocument();
    expect(screen.getByText('pedro@x.com')).toBeInTheDocument();
    // Story 97 — persistimos só dígitos; a exibição aplica a máscara.
    expect(screen.getByText('(62) 99999-8888')).toBeInTheDocument();
    expect(screen.getByText('Servo')).toBeInTheDocument();
  });

  it('o card inteiro é um link para o detalhe', () => {
    render(
      <StaffCard staff={makeStaff()} href="/staff/s1" onEdit={noop} onResetPassword={noop} onDelete={noop} />,
    );
    expect(screen.getByText('Pedro Servo').closest('a')).toHaveAttribute('href', '/staff/s1');
  });

  it('clicar no card navega pelo router (sem recarregar a página)', () => {
    rtlRender(
      <MemoryRouter initialEntries={['/staff']}>
        <Routes>
          <Route
            path="/staff"
            element={
              <StaffCard staff={makeStaff()} href="/staff/s1" onEdit={noop} onResetPassword={noop} onDelete={noop} />
            }
          />
          <Route path="/staff/:id" element={<p>detalhe</p>} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText('Pedro Servo'));
    expect(screen.getByText('detalhe')).toBeInTheDocument();
  });

  it('mostra o rank apenas para SERVANT', () => {
    const { rerender } = render(
      <StaffCard staff={makeStaff()} href="/staff/s1" onEdit={noop} onResetPassword={noop} onDelete={noop} />,
    );
    expect(screen.getByText('Aspirante')).toBeInTheDocument();

    rerender(
      <StaffCard
        staff={makeStaff({ user: { email: 'a@x.com', role: Role.ADMIN } as Staff['user'] })}
        href="/staff/s1"
        onEdit={noop}
        onResetPassword={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('Administrador')).toBeInTheDocument();
    expect(screen.queryByText('Aspirante')).not.toBeInTheDocument();
  });

  it('dispara os callbacks dos botões sem seguir o link do card', () => {
    const onEdit = vi.fn();
    const onReset = vi.fn();
    const onDelete = vi.fn();
    render(
      <StaffCard staff={makeStaff()} href="/staff/s1" onEdit={onEdit} onResetPassword={onReset} onDelete={onDelete} />,
    );
    // fireEvent devolve false quando o handler chamou preventDefault — a navegação do <a> é cancelada.
    expect(fireEvent.click(screen.getByTitle('Editar'))).toBe(false);
    expect(fireEvent.click(screen.getByTitle('Resetar senha'))).toBe(false);
    expect(fireEvent.click(screen.getByTitle('Excluir cadastro'))).toBe(false);
    expect(onEdit).toHaveBeenCalledTimes(1);
    expect(onReset).toHaveBeenCalledTimes(1);
    expect(onDelete).toHaveBeenCalledTimes(1);
  });

  it('desligado mostra o selo com a data e esconde Resetar senha (story 217)', () => {
    render(
      <StaffCard
        staff={makeStaff({ dismissedAt: '2025-01-10' })}
        href="/staff/s1"
        onEdit={noop}
        onResetPassword={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByText('Desligado em 10/01/2025')).toBeInTheDocument();
    expect(screen.queryByTitle('Resetar senha')).toBeNull();
  });

  it('renderiza foto quando há photoUrl', () => {
    render(
      <StaffCard
        staff={makeStaff({ photoUrl: 'http://img/p.jpg', house: null })}
        href="/staff/s1"
        onEdit={noop}
        onResetPassword={noop}
        onDelete={noop}
      />,
    );
    expect(screen.getByRole('img')).toHaveAttribute('src', 'http://img/p.jpg');
  });
});
