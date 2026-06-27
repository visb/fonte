import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';

let listState: { data: unknown[]; isLoading: boolean } = { data: [], isLoading: false };

vi.mock('../../hooks/useHouseRules', () => ({
  useHouseRules: () => listState,
}));
vi.mock('./AddRuleDialog', () => ({
  AddRuleDialog: ({ open }: { open: boolean }) => (open ? <div data-testid="add-rule" /> : null),
}));
vi.mock('./RemoveRuleDialog', () => ({
  RemoveRuleDialog: ({ rule }: { rule: unknown }) => (rule ? <div data-testid="remove-rule" /> : null),
}));

import { RulesTab } from './RulesTab';

beforeEach(() => {
  vi.clearAllMocks();
  listState = { data: [], isLoading: false };
});
afterEach(() => cleanup());

describe('RulesTab', () => {
  it('loading mostra carregamento', () => {
    listState = { data: [], isLoading: true };
    render(<RulesTab houseId="h1" />);
    expect(screen.getByText(/Carregando/i)).toBeInTheDocument();
  });

  it('vazio mostra mensagem', () => {
    render(<RulesTab houseId="h1" />);
    expect(screen.getByText('Nenhuma regra cadastrada.')).toBeInTheDocument();
  });

  it('lista regras com título e conteúdo', () => {
    listState = {
      data: [{ id: 'r1', title: 'Silêncio', content: 'Após as 22h' }],
      isLoading: false,
    };
    render(<RulesTab houseId="h1" />);
    expect(screen.getByText('Silêncio')).toBeInTheDocument();
    expect(screen.getByText('Após as 22h')).toBeInTheDocument();
  });

  it('abre dialog de nova regra e de remoção', () => {
    listState = {
      data: [{ id: 'r1', title: 'Silêncio', content: 'Após as 22h' }],
      isLoading: false,
    };
    render(<RulesTab houseId="h1" />);
    fireEvent.click(screen.getByRole('button', { name: /Nova regra/ }));
    expect(screen.getByTestId('add-rule')).toBeInTheDocument();
    fireEvent.click(screen.getByTitle('Remover regra'));
    expect(screen.getByTestId('remove-rule')).toBeInTheDocument();
  });
});
