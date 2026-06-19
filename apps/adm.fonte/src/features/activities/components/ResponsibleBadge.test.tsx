import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import type { ActivityStaffRef } from '@fonte/types';
import { ResponsibleBadge } from './ResponsibleBadge';

const responsible: ActivityStaffRef = {
  id: 'staff-1',
  name: 'Maria da Silva',
  userId: 'user-1',
};

describe('ResponsibleBadge', () => {
  it('com responsável mostra nome e avatar de iniciais', () => {
    render(<ResponsibleBadge responsible={responsible} />);
    expect(screen.getByText('Maria da Silva')).toBeInTheDocument();
    // Avatar com as iniciais derivadas do nome.
    expect(screen.getByText('MS')).toBeInTheDocument();
    expect(screen.getByTitle('Responsável: Maria da Silva')).toBeInTheDocument();
  });

  it('sem responsável mostra estado esmaecido "Sem responsável"', () => {
    render(<ResponsibleBadge responsible={null} />);
    expect(screen.getByText('Sem responsável')).toBeInTheDocument();
    expect(screen.getByTitle('Sem responsável')).toBeInTheDocument();
    // Não há nome nem iniciais quando não há responsável.
    expect(screen.queryByText('MS')).not.toBeInTheDocument();
  });

  it('mostra nome de um único termo com inicial única', () => {
    render(<ResponsibleBadge responsible={{ ...responsible, name: 'Ana' }} />);
    expect(screen.getByText('Ana')).toBeInTheDocument();
    expect(screen.getByText('A')).toBeInTheDocument();
    // Não cai no estado "sem responsável" quando há um nome válido.
    expect(screen.queryByText('Sem responsável')).not.toBeInTheDocument();
  });
});
