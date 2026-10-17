import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';
import { queryKeys } from '@/lib/queryKeys';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

let mockOnline = true;
jest.mock('@/lib/offline/network', () => ({ useIsOnline: () => mockOnline }));

jest.mock('@/lib/api', () => ({
  api: {
    residents: { update: jest.fn() },
    houses: { listMinistries: jest.fn() },
  },
}));

import { api } from '@/lib/api';
import { ChangeMinistryModal } from './ChangeMinistryModal';

const m = api as unknown as { residents: Record<string, jest.Mock>; houses: Record<string, jest.Mock> };

function renderWith(ui: React.ReactElement, client = createTestQueryClient()) {
  return { client, ...render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>) };
}

const props = {
  visible: true,
  onClose: jest.fn(),
  residentId: 'r1',
  houseId: 'h1',
  currentMinistryId: null as string | null,
};

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
});

describe('ChangeMinistryModal (story 205)', () => {
  it('lista só os ministérios da casa do filho + opção Nenhum', async () => {
    m.houses.listMinistries.mockResolvedValue([
      { id: 'min1', name: 'Cozinha' },
      { id: 'min2', name: 'Limpeza' },
    ]);
    renderWith(<ChangeMinistryModal {...props} />);
    await waitFor(() => expect(screen.getByText('Cozinha')).toBeTruthy());
    expect(screen.getByText('Nenhum')).toBeTruthy();
    expect(screen.getByText('Limpeza')).toBeTruthy();
    expect(m.houses.listMinistries).toHaveBeenCalledWith('h1');
  });

  it('abre offline com os ministérios do store local (house-ministries)', () => {
    const client = createTestQueryClient();
    client.setDefaultOptions({ queries: { retry: false, staleTime: Infinity } });
    client.setQueryData(queryKeys.houses.ministries('h1'), [{ id: 'min9', name: 'Horta' }]);
    renderWith(<ChangeMinistryModal {...props} />, client);
    expect(screen.getByText('Horta')).toBeTruthy();
    expect(m.houses.listMinistries).not.toHaveBeenCalled();
  });

  it('confirmar sem mudança apenas fecha (não muta)', async () => {
    const onClose = jest.fn();
    m.houses.listMinistries.mockResolvedValue([]);
    renderWith(<ChangeMinistryModal {...props} onClose={onClose} />);
    await waitFor(() => expect(screen.getByText('Nenhum')).toBeTruthy());
    fireEvent.press(screen.getByText('Confirmar'));
    expect(m.residents.update).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });

  it('selecionar outro ministério e confirmar grava o ministryId e invalida a ficha', async () => {
    const onClose = jest.fn();
    m.houses.listMinistries.mockResolvedValue([{ id: 'min1', name: 'Cozinha' }]);
    m.residents.update.mockResolvedValue({ id: 'r1' });
    const client = createTestQueryClient();
    const spy = jest.spyOn(client, 'invalidateQueries');
    renderWith(<ChangeMinistryModal {...props} onClose={onClose} />, client);
    await waitFor(() => expect(screen.getByText('Cozinha')).toBeTruthy());
    fireEvent.press(screen.getByText('Cozinha'));
    fireEvent.press(screen.getByText('Confirmar'));
    await waitFor(() => expect(m.residents.update).toHaveBeenCalledWith('r1', { ministryId: 'min1' }));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.residents.detail('r1') });
    expect(spy).toHaveBeenCalledWith({ queryKey: queryKeys.houses.ministries('h1') });
  });

  it('tirar do ministério grava null', async () => {
    m.houses.listMinistries.mockResolvedValue([{ id: 'min1', name: 'Cozinha' }]);
    m.residents.update.mockResolvedValue({ id: 'r1' });
    renderWith(<ChangeMinistryModal {...props} currentMinistryId="min1" />);
    await waitFor(() => expect(screen.getByText('Cozinha')).toBeTruthy());
    fireEvent.press(screen.getByText('Nenhum'));
    fireEvent.press(screen.getByText('Confirmar'));
    await waitFor(() => expect(m.residents.update).toHaveBeenCalledWith('r1', { ministryId: null }));
  });

  it('400 do backend aparece no modal', async () => {
    m.houses.listMinistries.mockResolvedValue([{ id: 'min1', name: 'Cozinha' }]);
    m.residents.update.mockRejectedValue({
      isAxiosError: true,
      response: { data: { message: 'Só filho em acolhimento nesta casa pode participar do ministério.' } },
    });
    renderWith(<ChangeMinistryModal {...props} />);
    await waitFor(() => expect(screen.getByText('Cozinha')).toBeTruthy());
    fireEvent.press(screen.getByText('Cozinha'));
    fireEvent.press(screen.getByText('Confirmar'));
    await waitFor(() => expect(screen.getByText(/Só filho em acolhimento|Não foi possível/)).toBeTruthy());
  });

  it('sem sinal: aviso e Confirmar desabilitado', async () => {
    mockOnline = false;
    m.houses.listMinistries.mockResolvedValue([{ id: 'min1', name: 'Cozinha' }]);
    renderWith(<ChangeMinistryModal {...props} />);
    expect(screen.getByText('Precisa de conexão para trocar o ministério.')).toBeTruthy();
    await waitFor(() => expect(screen.getByText('Cozinha')).toBeTruthy());
    fireEvent.press(screen.getByText('Cozinha'));
    fireEvent.press(screen.getByText('Confirmar'));
    expect(m.residents.update).not.toHaveBeenCalled();
  });

  it('Cancelar e o X fecham', async () => {
    const onClose = jest.fn();
    m.houses.listMinistries.mockResolvedValue([]);
    renderWith(<ChangeMinistryModal {...props} onClose={onClose} />);
    fireEvent.press(screen.getByText('Cancelar'));
    fireEvent.press(screen.getByLabelText('Fechar'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
