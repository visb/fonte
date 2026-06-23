import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { StreetSaleType } from '@fonte/types';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));
jest.mock('@/lib/api', () => ({ api: { streetSales: { remove: jest.fn() } } }));

import { api } from '@/lib/api';
import { ProductTypeSelector } from './ProductTypeSelector';
import { AmountField } from './AmountField';
import { StreetSaleFormFields } from './StreetSaleFormFields';
import { StreetSaleRow } from './StreetSaleRow';

const m = api as unknown as { streetSales: Record<string, jest.Mock> };

function rc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('ProductTypeSelector', () => {
  it('renderiza Pão/Pizza e dispara onChange', () => {
    const onChange = jest.fn();
    render(<ProductTypeSelector value={StreetSaleType.BREAD} onChange={onChange} />);
    expect(screen.getByText('Pão')).toBeTruthy();
    fireEvent.press(screen.getByText('Pizza'));
    expect(onChange).toHaveBeenCalledWith(StreetSaleType.PIZZA);
  });
});

describe('AmountField / StreetSaleFormFields', () => {
  function Harness() {
    const { useForm } = require('react-hook-form');
    const { control, formState: { errors } } = useForm({
      defaultValues: { date: '2026-01-01', type: StreetSaleType.BREAD, quantity: '', amountPix: '', amountCash: '', amountCard: '' },
    });
    return (
      <StreetSaleFormFields
        control={control}
        errors={errors}
        totalAmount="10.5"
        onDatePress={jest.fn()}
        dateLabel="01/01/2026"
      />
    );
  }

  it('renderiza os campos, o seletor de produto e o total calculado', () => {
    render(<Harness />);
    expect(screen.getByText('Produto')).toBeTruthy();
    expect(screen.getByText('PIX (R$)')).toBeTruthy();
    expect(screen.getByText('Total arrecadado')).toBeTruthy();
    expect(screen.getByText('R$ 10,50')).toBeTruthy();
  });

  it('AmountField edita via Controller e mostra erro', () => {
    const { useForm } = require('react-hook-form');
    function H() {
      const { control } = useForm({ defaultValues: { v: '' } });
      return <AmountField control={control} name="v" label="PIX" errors={{ v: { message: 'inválido' } } as never} />;
    }
    render(<H />);
    expect(screen.getByText('inválido')).toBeTruthy();
    fireEvent.changeText(screen.getByPlaceholderText('0,00'), '5,00');
    expect(screen.getByPlaceholderText('0,00').props.value).toBe('5,00');
  });
});

describe('StreetSaleRow', () => {
  function makeSale(overrides = {}) {
    return {
      id: 's1',
      type: StreetSaleType.BREAD,
      date: '2026-03-10',
      quantity: 20,
      totalAmount: 5000,
      amountPix: 2000,
      amountCash: 2000,
      amountCard: 1000,
      createdAt: new Date().toISOString(), // dentro da janela de edição
      ...overrides,
    } as never;
  }

  it('mostra tipo (Pão), data, total e formas de pagamento', () => {
    rc(<StreetSaleRow sale={makeSale()} houseId="h1" />);
    expect(screen.getByText('Pão')).toBeTruthy();
    expect(screen.getByText('10/03/2026')).toBeTruthy();
    expect(screen.getByText('R$ 50,00')).toBeTruthy();
    expect(screen.getByText('PIX R$ 20,00')).toBeTruthy();
  });

  it('dentro da janela mostra editar/remover; editar navega', () => {
    rc(<StreetSaleRow sale={makeSale()} houseId="h1" />);
    fireEvent.press(screen.getByText('icon:pencil-outline'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/street-sales/s1');
  });

  it('fora da janela (criado há 2h) não mostra ações de edição', () => {
    const old = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
    rc(<StreetSaleRow sale={makeSale({ createdAt: old })} houseId="h1" />);
    expect(screen.queryByText('icon:pencil-outline')).toBeNull();
  });

  it('remover abre o Alert de confirmação e ao confirmar muta delete', async () => {
    let confirmHandler: (() => void) | undefined;
    jest.spyOn(Alert, 'alert').mockImplementation((_t, _m, buttons) => {
      confirmHandler = (buttons?.[1] as { onPress?: () => void })?.onPress;
    });
    m.streetSales.remove.mockResolvedValue(undefined);
    rc(<StreetSaleRow sale={makeSale()} houseId="h1" />);
    fireEvent.press(screen.getByText('icon:trash-outline'));
    expect(Alert.alert).toHaveBeenCalled();
    confirmHandler?.();
    await waitFor(() => expect(m.streetSales.remove).toHaveBeenCalledWith('s1'));
  });
});
