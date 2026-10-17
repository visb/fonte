import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { MovementType, todayInSaoPaulo } from '@fonte/types';
import { DATE_FIELD_MESSAGES } from '@/lib/date';

// Story 209: a data da movimentação do almoxarifado é digitável. O que importa
// aqui é o payload (o mesmo de antes, data ISO) e a regra "retroativo sim,
// futuro não".

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('expo-router', () => ({ router: { replace: jest.fn() } }));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ staff: { id: 's1', name: 'Servo X', houseId: 'h1' } }),
}));
const mockSubmit = jest.fn();
jest.mock('@/lib/offline/fieldSubmit', () => ({ useFieldSubmit: () => mockSubmit }));
jest.mock('@/features/supply-room/hooks/useSupplyRoom', () => ({
  useSupplyRoomItems: () => ({
    data: [{ id: 'i1', name: 'Detergente', unit: 'L', currentQuantity: 10, category: 'CLEANING' }],
  }),
  useCreateSupplyMovement: () => ({ isPending: false }),
  useCreateSupplyItem: () => ({ isPending: false }),
}));

import { MovementPage } from './MovementPage';

beforeEach(() => jest.clearAllMocks());

function fillItemAndQuantity() {
  fireEvent(screen.getByPlaceholderText('Buscar item...'), 'focus');
  fireEvent.press(screen.getByText('Detergente'));
  fireEvent.changeText(screen.getByPlaceholderText('0'), '2');
}

describe('supply-room MovementPage — data digitável (story 209)', () => {
  it('vem com hoje e a data digitada (retroativa) chega ao payload', async () => {
    render(<MovementPage />);
    const [y, m, d] = todayInSaoPaulo().split('-');
    expect(screen.getByLabelText('Data').props.value).toBe(`${d}/${m}/${y}`);
    fillItemAndQuantity();
    fireEvent.changeText(screen.getByLabelText('Data'), '05032026');
    fireEvent.press(screen.getByText('Registrar entrada'));
    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({
          itemId: 'i1',
          type: MovementType.IN,
          quantity: 2,
          date: '2026-03-05',
          responsibleId: 's1',
        }),
        expect.any(Object),
      ),
    );
  });

  it('data futura é recusada', async () => {
    render(<MovementPage />);
    fillItemAndQuantity();
    fireEvent.changeText(screen.getByLabelText('Data'), '01012999');
    fireEvent.press(screen.getByText('Registrar entrada'));
    await waitFor(() => expect(screen.getByText(DATE_FIELD_MESSAGES.future)).toBeTruthy());
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
