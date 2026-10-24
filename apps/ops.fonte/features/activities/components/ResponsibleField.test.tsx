import { useState } from 'react';
import { fireEvent, render, screen } from '@testing-library/react-native';

const mockMutation = { mutate: jest.fn(), reset: jest.fn(), isPending: false, error: null };

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('@/lib/offline/network', () => ({ useIsOnline: () => false }));
jest.mock('@/features/staff/hooks/useHouseStaff', () => ({
  useHouseStaff: () => ({
    data: [
      { id: 's1', name: 'Ana' },
      { id: 's2', name: 'Bruno' },
    ],
    isLoading: false,
    error: null,
    refetch: jest.fn(),
  }),
}));
jest.mock('@/features/activities/hooks/useActivities', () => ({
  useUpdateActivity: () => mockMutation,
  useChangeActivityStatus: () => mockMutation,
}));

import { ResponsibleField } from './ResponsibleField';

function Harness({ required, initial = null }: { required?: boolean; initial?: string | null }) {
  const [value, setValue] = useState<string | null>(initial);
  return (
    <ResponsibleField
      value={value}
      onChange={setValue}
      houseId="h1"
      required={required}
      error={required && !value ? 'Escolha o responsável' : undefined}
    />
  );
}

describe('ResponsibleField (story 224)', () => {
  it('vazio: mostra "Sem responsável"; escolher abre o modal e mostra o escolhido', () => {
    render(<Harness />);
    expect(screen.getByLabelText('Sem responsável')).toBeTruthy();
    expect(screen.queryByTestId('select-responsible-modal')).toBeNull();

    fireEvent.press(screen.getByLabelText('Escolher responsável'));
    expect(screen.getByText('Escolher responsável')).toBeTruthy();
    // Modo escolher funciona offline (lista do cache): sem aviso de conexão.
    expect(screen.queryByText(/Precisa de conexão/)).toBeNull();

    fireEvent.press(screen.getByLabelText('Responsável Bruno'));
    expect(screen.queryByTestId('select-responsible-modal')).toBeNull();
    expect(screen.getByLabelText('Responsável: Bruno')).toBeTruthy();
    expect(mockMutation.mutate).not.toHaveBeenCalled();
  });

  it('limpar volta a vazio', () => {
    render(<Harness initial="s1" />);
    expect(screen.getByLabelText('Responsável: Ana')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Limpar responsável'));
    expect(screen.getByLabelText('Sem responsável')).toBeTruthy();
  });

  it('obrigatório (A fazer): sem "limpar", com asterisco e erro', () => {
    render(<Harness required />);
    expect(screen.getByText('*')).toBeTruthy();
    expect(screen.getByText('Escolha o responsável')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Escolher responsável'));
    fireEvent.press(screen.getByLabelText('Responsável Ana'));
    expect(screen.queryByLabelText('Limpar responsável')).toBeNull();
    expect(screen.getByLabelText('Trocar responsável')).toBeTruthy();
  });

  it('fechar o modal sem escolher mantém vazio', () => {
    render(<Harness />);
    fireEvent.press(screen.getByLabelText('Escolher responsável'));
    fireEvent.press(screen.getByLabelText('Fechar'));
    expect(screen.queryByTestId('select-responsible-modal')).toBeNull();
    expect(screen.getByLabelText('Sem responsável')).toBeTruthy();
  });
});
