import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { StreetSaleType, todayInSaoPaulo } from '@fonte/types';
import { DATE_FIELD_MESSAGES } from '@/lib/date';

// Story 209: a data da venda de rua é digitável (nova e edição). O payload é o
// de sempre (data ISO) e a regra é "retroativo sim, futuro não".

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('expo-router', () => ({ router: { replace: jest.fn(), back: jest.fn() } }));
jest.mock('@/lib/auth', () => ({
  useAuth: () => ({ staff: { id: 's1', name: 'Servo X', houseId: 'h1' } }),
}));
const mockSubmit = jest.fn();
jest.mock('@/lib/offline/fieldSubmit', () => ({ useFieldSubmit: () => mockSubmit }));
jest.mock('../hooks/useStreetSales', () => ({
  useCreateStreetSale: () => ({ isPending: false }),
  useUpdateStreetSale: () => ({ isPending: false }),
}));

import { NewStreetSalePage } from './NewStreetSalePage';
import { EditStreetSalePage } from './EditStreetSalePage';

beforeEach(() => jest.clearAllMocks());

const dateInput = () => screen.getByLabelText('Data');

describe('NewStreetSalePage — data digitável (story 209)', () => {
  it('vem com hoje e a data digitada chega ao payload', async () => {
    render(<NewStreetSalePage />);
    const [y, m, d] = todayInSaoPaulo().split('-');
    expect(dateInput().props.value).toBe(`${d}/${m}/${y}`);
    fireEvent.changeText(screen.getByPlaceholderText('0'), '12');
    fireEvent.changeText(dateInput(), '02102026');
    fireEvent.press(screen.getByText('Registrar faturamento'));
    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith(
        expect.objectContaining({ houseId: 'h1', date: '2026-10-02', quantity: 12 }),
        expect.any(Object),
      ),
    );
  });

  it('data futura é recusada', async () => {
    render(<NewStreetSalePage />);
    fireEvent.changeText(screen.getByPlaceholderText('0'), '12');
    fireEvent.changeText(dateInput(), '01012999');
    fireEvent.press(screen.getByText('Registrar faturamento'));
    await waitFor(() => expect(screen.getByText(DATE_FIELD_MESSAGES.future)).toBeTruthy());
    expect(mockSubmit).not.toHaveBeenCalled();
  });

  it('data incompleta é recusada', async () => {
    render(<NewStreetSalePage />);
    fireEvent.changeText(screen.getByPlaceholderText('0'), '12');
    fireEvent.changeText(dateInput(), '0210');
    fireEvent.press(screen.getByText('Registrar faturamento'));
    await waitFor(() => expect(screen.getByText(DATE_FIELD_MESSAGES.required)).toBeTruthy());
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});

describe('EditStreetSalePage — data digitável (story 209)', () => {
  const sale = {
    id: 'ss1',
    date: '2026-03-10',
    type: StreetSaleType.PIZZA,
    quantity: 4,
    amountPix: 1000,
    amountCash: 0,
    amountCard: 0,
  } as never;

  it('mostra a data da venda e a nova data digitada chega ao payload', async () => {
    render(<EditStreetSalePage sale={sale} />);
    expect(dateInput().props.value).toBe('10/03/2026');
    fireEvent.changeText(dateInput(), '11032026');
    fireEvent.press(screen.getByText('Salvar alterações'));
    await waitFor(() =>
      expect(mockSubmit).toHaveBeenCalledWith(
        { id: 'ss1', data: expect.objectContaining({ date: '2026-03-11', quantity: 4 }) },
        expect.any(Object),
      ),
    );
  });

  it('data futura é recusada', async () => {
    render(<EditStreetSalePage sale={sale} />);
    fireEvent.changeText(dateInput(), '01012999');
    fireEvent.press(screen.getByText('Salvar alterações'));
    await waitFor(() => expect(screen.getByText(DATE_FIELD_MESSAGES.future)).toBeTruthy());
    expect(mockSubmit).not.toHaveBeenCalled();
  });
});
