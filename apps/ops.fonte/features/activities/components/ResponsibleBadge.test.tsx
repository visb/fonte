import { render, screen } from '@testing-library/react-native';
import type { ActivityStaffRef } from '@fonte/types';
import { ResponsibleBadge } from './ResponsibleBadge';

// @expo/vector-icons depende do carregamento de fontes nativas (indisponível no
// ambiente jest-expo deste app); mockamos o ícone por um stub simples.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const responsible: ActivityStaffRef = {
  id: 'staff-1',
  name: 'Maria da Silva',
  userId: 'user-1',
};

describe('ResponsibleBadge', () => {
  it('com responsável mostra nome e avatar de iniciais', () => {
    render(<ResponsibleBadge responsible={responsible} />);
    expect(screen.getByText('Maria da Silva')).toBeOnTheScreen();
    expect(screen.getByText('MS')).toBeOnTheScreen();
    expect(screen.getByLabelText('Responsável: Maria da Silva')).toBeOnTheScreen();
  });

  it('sem responsável mostra estado esmaecido "Sem responsável"', () => {
    render(<ResponsibleBadge responsible={null} />);
    expect(screen.getByText('Sem responsável')).toBeOnTheScreen();
    expect(screen.getByLabelText('Sem responsável')).toBeOnTheScreen();
    expect(screen.queryByText('MS')).toBeNull();
  });
});
