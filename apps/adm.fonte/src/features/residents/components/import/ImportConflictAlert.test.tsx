import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import type { ImportConflict } from '@fonte/api-client';
import { ImportConflictAlert } from './ImportConflictAlert';

const conflict = (name: string): ImportConflict => ({
  id: name,
  name,
  cpf: null,
  status: 'ACTIVE' as never,
  houseName: null,
});

afterEach(() => cleanup());

describe('ImportConflictAlert', () => {
  it('não renderiza nada sem conflitos', () => {
    const { container } = render(<ImportConflictAlert conflicts={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('lista um filho já cadastrado', () => {
    render(<ImportConflictAlert conflicts={[conflict('João')]} />);
    expect(screen.getByText(/Já existe um filho cadastrado que confere: João/)).toBeInTheDocument();
  });

  it('lista vários filhos já cadastrados', () => {
    render(<ImportConflictAlert conflicts={[conflict('João'), conflict('Ana')]} />);
    expect(screen.getByText(/Já existem filhos cadastrados que conferem: João, Ana/)).toBeInTheDocument();
  });

  it('mostra o conflito de sessão', () => {
    render(<ImportConflictAlert conflicts={[]} sessionConflictName="Pedro" />);
    expect(screen.getByText(/Já importado nesta sessão: Pedro/)).toBeInTheDocument();
  });
});
