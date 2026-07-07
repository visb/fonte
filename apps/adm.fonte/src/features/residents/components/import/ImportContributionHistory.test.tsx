import { afterEach, describe, expect, it } from 'vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import { ImportContributionHistory } from './ImportContributionHistory';

afterEach(() => cleanup());

describe('ImportContributionHistory', () => {
  it('lista as competências formatadas como Mês/Ano', () => {
    render(<ImportContributionHistory months={['2023-01-01', '2023-02-01', '2023-12-01']} />);

    const list = screen.getByRole('list', { name: 'Histórico de contribuição' });
    const items = within(list).getAllByRole('listitem');
    expect(items).toHaveLength(3);
    expect(items[0]).toHaveTextContent('Janeiro/2023');
    expect(items[1]).toHaveTextContent('Fevereiro/2023');
    expect(items[2]).toHaveTextContent('Dezembro/2023');
  });

  it('formata competência ignorando a parte de dia/hora da ISO', () => {
    render(<ImportContributionHistory months={['2024-06-01T00:00:00.000Z']} />);
    expect(screen.getByText('Junho/2024')).toBeInTheDocument();
  });

  it('mostra EmptyState quando não há competências', () => {
    render(<ImportContributionHistory months={[]} />);
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
    expect(screen.getByText('Nenhuma contribuição registrada na planilha.')).toBeInTheDocument();
  });
});
