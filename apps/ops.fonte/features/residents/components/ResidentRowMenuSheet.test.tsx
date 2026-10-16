import { fireEvent, render, screen } from '@testing-library/react-native';
import { RESIDENT_ROW_ACTIONS } from '@fonte/types';

// Story 200: o `⋮` da lista separa saída da comunidade e transferência.

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

import { ResidentRowMenuSheet } from './ResidentRowMenuSheet';

function setup() {
  const onSelect = jest.fn();
  const onClose = jest.fn();
  render(
    <ResidentRowMenuSheet visible residentName="João" onClose={onClose} onSelect={onSelect} />,
  );
  return { onSelect, onClose };
}

describe('ResidentRowMenuSheet', () => {
  it('mostra os dois itens e o nome do filho', () => {
    setup();
    expect(screen.getByText('João')).toBeTruthy();
    expect(screen.getByText('Declarar saída da comunidade')).toBeTruthy();
    expect(screen.getByText('Transferir de casa')).toBeTruthy();
    expect(screen.getByText('icon:exit-outline')).toBeTruthy();
    expect(screen.getByText('icon:swap-horizontal-outline')).toBeTruthy();
    expect(screen.queryByText('Remover da casa')).toBeNull();
  });

  it.each([
    ['Declarar saída da comunidade', 'exit'],
    ['Transferir de casa', 'transfer'],
  ])('%s chama onSelect com mode %s', (label, mode) => {
    const { onSelect } = setup();
    fireEvent.press(screen.getByText(label));
    expect(onSelect).toHaveBeenCalledWith(mode);
  });

  it('Cancelar fecha sem escolher', () => {
    const { onSelect, onClose } = setup();
    fireEvent.press(screen.getByText('Cancelar'));
    expect(onClose).toHaveBeenCalled();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('RESIDENT_ROW_ACTIONS cobre cada ação de baixa exatamente uma vez', () => {
    expect(Object.values(RESIDENT_ROW_ACTIONS).flat().sort()).toEqual([
      'discharge',
      'evade',
      'transfer',
    ]);
  });
});
