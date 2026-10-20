import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { CPF_CONFLICT_ERROR_TYPE } from '@/lib/cpf';
import { CpfFieldError } from './CpfFieldError';

afterEach(() => cleanup());

describe('CpfFieldError (story 219)', () => {
  it('sem erro não renderiza nada', () => {
    const { container } = render(<CpfFieldError />);
    expect(container).toBeEmptyDOMElement();
  });

  it('CPF inválido: só a mensagem, sem link', () => {
    render(<CpfFieldError error={{ type: 'custom', message: 'CPF inválido.' }} />);
    expect(screen.getByRole('alert')).toHaveTextContent('CPF inválido.');
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('CPF em uso: mensagem + link para o cadastro do dono', () => {
    render(
      <MemoryRouter>
        <CpfFieldError
          error={{
            type: CPF_CONFLICT_ERROR_TYPE,
            message: 'Já existe um filho com este CPF: Bruno (Alta).',
            types: { [CPF_CONFLICT_ERROR_TYPE]: 'r9' },
          }}
        />
      </MemoryRouter>,
    );
    expect(screen.getByRole('alert')).toHaveTextContent('Já existe um filho com este CPF: Bruno (Alta).');
    const link = screen.getByRole('link', { name: 'Ver cadastro' });
    expect(link).toHaveAttribute('href', '/residents/r9');
    expect(link).toHaveAttribute('target', '_blank');
  });
});
