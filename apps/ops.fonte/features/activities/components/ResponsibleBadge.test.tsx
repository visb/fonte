import { fireEvent, render, screen } from '@testing-library/react-native';
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

  it('sem onPress não é botão (story 220)', () => {
    render(<ResponsibleBadge responsible={responsible} />);
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('com onPress vira botão de trocar e dispara (story 220)', () => {
    const onPress = jest.fn();
    render(<ResponsibleBadge responsible={responsible} onPress={onPress} />);
    fireEvent.press(screen.getByRole('button', { name: 'Trocar responsável: Maria da Silva' }));
    expect(onPress).toHaveBeenCalled();
  });

  it('sem responsável com onPress vira "Definir responsável" (story 220)', () => {
    const onPress = jest.fn();
    render(<ResponsibleBadge responsible={null} onPress={onPress} />);
    fireEvent.press(screen.getByLabelText('Definir responsável'));
    expect(onPress).toHaveBeenCalled();
  });

  it('desabilitado não dispara (story 220)', () => {
    const onPress = jest.fn();
    render(<ResponsibleBadge responsible={responsible} onPress={onPress} disabled />);
    fireEvent.press(screen.getByLabelText('Trocar responsável: Maria da Silva'));
    expect(onPress).not.toHaveBeenCalled();
  });

  it('nome sem iniciais usa o ícone (story 220)', () => {
    render(<ResponsibleBadge responsible={{ ...responsible, name: '' }} />);
    expect(screen.getByText('icon:person')).toBeOnTheScreen();
  });
});
