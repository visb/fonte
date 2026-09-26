import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient, expectIdempotencyKey } from '@/lib/test/utils';

// Story 196: o modal saiu de `features/census/components/` e estes specs vieram
// junto, de `CensusComponents.test.tsx`, SEM mudança de expectativa — a mudança
// é de lugar, não de comportamento.

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('@/components/DatePickerModal', () => ({ DatePickerModal: () => null }));
jest.mock('@/lib/api', () => ({
  api: {
    residents: { update: jest.fn() },
    houses: { list: jest.fn() },
  },
  resolveAssetUrl: (u: string | null) => u,
}));

import { api } from '@/lib/api';
import { RemoveResidentModal } from './RemoveResidentModal';

const m = api as unknown as {
  residents: Record<string, jest.Mock>;
  houses: Record<string, jest.Mock>;
};

function rc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('RemoveResidentModal', () => {
  const props = {
    visible: true,
    houseId: 'h1',
    resident: { id: 'r1', name: 'João' },
    onClose: jest.fn(),
    onSuccess: jest.fn(),
  };

  it('lista as ações de remoção (alta/evasão/transferência)', async () => {
    m.houses.list.mockResolvedValue([]);
    rc(<RemoveResidentModal {...props} />);
    expect(screen.getByText('Declarar alta')).toBeTruthy();
    expect(screen.getByText('Evasão')).toBeTruthy();
    expect(screen.getByText('Transferir para outra casa')).toBeTruthy();
  });

  it('transferência lista outras casas (exclui a atual)', async () => {
    m.houses.list.mockResolvedValue([
      { id: 'h1', name: 'Casa Atual' },
      { id: 'h2', name: 'Casa Bethel' },
    ]);
    rc(<RemoveResidentModal {...props} />);
    fireEvent.press(screen.getByText('Transferir para outra casa'));
    await waitFor(() => expect(screen.getByText('Casa Bethel')).toBeTruthy());
    expect(screen.queryByText('Casa Atual')).toBeNull();
  });

  it('transferência sem outras casas mostra aviso', async () => {
    m.houses.list.mockResolvedValue([{ id: 'h1', name: 'Casa Atual' }]);
    rc(<RemoveResidentModal {...props} />);
    fireEvent.press(screen.getByText('Transferir para outra casa'));
    await waitFor(() => expect(screen.getByText('Nenhuma outra casa disponível.')).toBeTruthy());
  });

  it('alta atualiza o residente para DISCHARGED com data de saída', async () => {
    m.houses.list.mockResolvedValue([]);
    m.residents.update.mockResolvedValue({ id: 'r1' });
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    rc(<RemoveResidentModal {...props} onSuccess={onSuccess} onClose={onClose} />);
    fireEvent.press(screen.getByText('Declarar alta'));
    fireEvent.press(screen.getByText('Confirmar'));
    await waitFor(() =>
      expect(m.residents.update).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({ status: 'DISCHARGED', exitDate: expect.any(String) }),
        expectIdempotencyKey,
      ),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('evasão atualiza o residente para EVADED', async () => {
    m.houses.list.mockResolvedValue([]);
    m.residents.update.mockResolvedValue({ id: 'r1' });
    rc(<RemoveResidentModal {...props} />);
    fireEvent.press(screen.getByText('Evasão'));
    fireEvent.press(screen.getByText('Confirmar'));
    await waitFor(() =>
      expect(m.residents.update).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({ status: 'EVADED' }),
        expectIdempotencyKey,
      ),
    );
  });

  it('transferência seleciona a casa de destino e atualiza houseId', async () => {
    m.houses.list.mockResolvedValue([
      { id: 'h1', name: 'Casa Atual' },
      { id: 'h2', name: 'Casa Bethel' },
    ]);
    m.residents.update.mockResolvedValue({ id: 'r1' });
    rc(<RemoveResidentModal {...props} />);
    fireEvent.press(screen.getByText('Transferir para outra casa'));
    await waitFor(() => expect(screen.getByText('Casa Bethel')).toBeTruthy());
    fireEvent.press(screen.getByText('Casa Bethel'));
    fireEvent.press(screen.getByText('Confirmar'));
    await waitFor(() =>
      expect(m.residents.update).toHaveBeenCalledWith('r1', { houseId: 'h2' }, expectIdempotencyKey),
    );
  });

  it('erro na ação mostra Alert', async () => {
    const { Alert } = require('react-native');
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    m.houses.list.mockResolvedValue([]);
    m.residents.update.mockRejectedValue(new Error('falhou'));
    rc(<RemoveResidentModal {...props} />);
    fireEvent.press(screen.getByText('Declarar alta'));
    fireEvent.press(screen.getByText('Confirmar'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Erro', expect.any(String)));
  });
});
