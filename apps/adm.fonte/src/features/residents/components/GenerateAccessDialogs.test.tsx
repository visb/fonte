import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent, waitFor } from '@testing-library/react';

const relMutate = vi.fn();
const resMutate = vi.fn();
let relState = { isPending: false, isError: false, error: null as unknown };
let resState = { isPending: false, isError: false, error: null as unknown };

vi.mock('../hooks/useResidents', () => ({
  useGenerateRelativeAccess: () => ({ mutate: relMutate, ...relState }),
  useGenerateResidentAccess: () => ({ mutate: resMutate, ...resState }),
}));

import { GenerateRelativeAccessDialog } from './GenerateRelativeAccessDialog';
import { GenerateResidentAccessDialog } from './GenerateResidentAccessDialog';

beforeEach(() => {
  vi.clearAllMocks();
  relState = { isPending: false, isError: false, error: null };
  resState = { isPending: false, isError: false, error: null };
  // jsdom não implementa clipboard por padrão
  Object.assign(navigator, { clipboard: { writeText: vi.fn() } });
});
afterEach(() => cleanup());

describe('GenerateRelativeAccessDialog', () => {
  it('mostra nome do familiar e senha gerada (12 chars)', () => {
    render(
      <GenerateRelativeAccessDialog open onClose={vi.fn()} relative={{ id: 'r1', name: 'Mãe B' }} />,
    );
    expect(screen.getByText('Mãe B')).toBeInTheDocument();
    expect(screen.getByText('Senha gerada')).toBeInTheDocument();
  });

  it('email inválido bloqueia mutate; email válido muta com senha', async () => {
    render(
      <GenerateRelativeAccessDialog open onClose={vi.fn()} relative={{ id: 'r1', name: 'Mãe B' }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Acesso' }));
    expect(await screen.findByText('E-mail inválido')).toBeInTheDocument();
    expect(relMutate).not.toHaveBeenCalled();

    fireEvent.input(screen.getByLabelText('E-mail'), { target: { value: 'mae@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Acesso' }));
    await waitFor(() => expect(relMutate).toHaveBeenCalled());
    const arg = relMutate.mock.calls[0][0];
    expect(arg.email).toBe('mae@x.com');
    expect(typeof arg.password).toBe('string');
    expect(arg.password.length).toBe(12);
  });

  it('copiar usa clipboard', () => {
    render(
      <GenerateRelativeAccessDialog open onClose={vi.fn()} relative={{ id: 'r1', name: 'Mãe B' }} />,
    );
    fireEvent.click(screen.getByRole('button', { name: /Copiar/ }));
    expect(navigator.clipboard.writeText).toHaveBeenCalled();
  });

  it('mostra erro da mutation', () => {
    relState = { isPending: false, isError: true, error: new Error('boom') };
    render(
      <GenerateRelativeAccessDialog open onClose={vi.fn()} relative={{ id: 'r1', name: 'Mãe B' }} />,
    );
    expect(screen.getByText(/Erro ao gerar acesso|boom/)).toBeInTheDocument();
  });
});

describe('GenerateResidentAccessDialog', () => {
  it('muta com email válido + senha de 12 chars', async () => {
    render(
      <GenerateResidentAccessDialog open onClose={vi.fn()} resident={{ id: 'res1', name: 'Filho A' }} />,
    );
    expect(screen.getByText('Filho A')).toBeInTheDocument();
    fireEvent.input(screen.getByLabelText('E-mail'), { target: { value: 'filho@x.com' } });
    fireEvent.click(screen.getByRole('button', { name: 'Gerar Acesso' }));
    await waitFor(() => expect(resMutate).toHaveBeenCalled());
    expect(resMutate.mock.calls[0][0].password.length).toBe(12);
  });

  it('pending mostra "Gerando..." e desabilita', () => {
    resState = { isPending: true, isError: false, error: null };
    render(
      <GenerateResidentAccessDialog open onClose={vi.fn()} resident={{ id: 'res1', name: 'Filho A' }} />,
    );
    expect(screen.getByRole('button', { name: 'Gerando...' })).toBeDisabled();
  });
});
