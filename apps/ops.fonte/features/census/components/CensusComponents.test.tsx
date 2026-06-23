import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient } from '@/lib/test/utils';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));
jest.mock('@/components/DatePickerModal', () => ({ DatePickerModal: () => null }));
jest.mock('@/lib/api', () => ({
  api: {
    residents: { uploadPhoto: jest.fn() },
    houses: { list: jest.fn() },
    census: { addResident: jest.fn() },
  },
  resolveAssetUrl: (u: string | null) => u,
}));

import { api } from '@/lib/api';
import { CensusListItem } from './CensusListItem';
import { ConcludeCensusModal } from './ConcludeCensusModal';
import { AddResidentModal } from './AddResidentModal';
import { RemoveResidentModal } from './RemoveResidentModal';

const m = api as unknown as { residents: Record<string, jest.Mock>; houses: Record<string, jest.Mock>; census: Record<string, jest.Mock> };

function rc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => jest.clearAllMocks());

describe('CensusListItem', () => {
  const resident = { id: 'r1', name: 'João' };

  it('confirma e remove disparam os callbacks', () => {
    const onConfirm = jest.fn();
    const onRemove = jest.fn();
    render(<CensusListItem resident={resident} confirmed={false} onConfirm={onConfirm} onRemove={onRemove} />);
    expect(screen.getByText('João')).toBeTruthy();
    fireEvent.press(screen.getByText('icon:checkmark'));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.press(screen.getByText('icon:trash-outline'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('pending mostra badge de aprovação e check fixo (sem onConfirm)', () => {
    const onConfirm = jest.fn();
    render(<CensusListItem resident={resident} confirmed={false} pending onConfirm={onConfirm} onRemove={jest.fn()} />);
    expect(screen.getByText('Aguardando aprovação')).toBeTruthy();
    // o check existe mas é fixo (View, não TouchableOpacity) → onConfirm não dispara
    fireEvent.press(screen.getByText('icon:checkmark'));
    expect(onConfirm).not.toHaveBeenCalled();
  });
});

describe('ConcludeCensusModal', () => {
  it('mostra contagem e dispara concluir/revisar', () => {
    const onConfirm = jest.fn();
    const onClose = jest.fn();
    render(<ConcludeCensusModal visible confirmedCount={5} total={8} isPending={false} onConfirm={onConfirm} onClose={onClose} />);
    expect(screen.getByText('5/8 confirmados')).toBeTruthy();
    fireEvent.press(screen.getByText('Concluir'));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.press(screen.getByText('Revisar'));
    expect(onClose).toHaveBeenCalled();
  });

  it('pending oculta o rótulo Concluir', () => {
    render(<ConcludeCensusModal visible confirmedCount={5} total={8} isPending onConfirm={jest.fn()} onClose={jest.fn()} />);
    expect(screen.queryByText('Concluir')).toBeNull();
  });
});

describe('AddResidentModal', () => {
  const props = { visible: true, houseId: 'h1', onClose: jest.fn(), onSuccess: jest.fn() };

  it('submete com defaults válidos (nome preenchido)', async () => {
    m.census.addResident.mockResolvedValue({ id: 'r1' });
    rc(<AddResidentModal {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Novo Filho');
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() =>
      expect(m.census.addResident).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Novo Filho', houseId: 'h1', gender: 'MALE' }),
      ),
    );
  });

  it('nome vazio mostra erro de validação e não cria', async () => {
    rc(<AddResidentModal {...props} />);
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() => expect(screen.getByText('Informe o nome')).toBeTruthy());
    expect(m.census.addResident).not.toHaveBeenCalled();
  });

  it('alterna o gênero para Feminino', async () => {
    m.census.addResident.mockResolvedValue({ id: 'r1' });
    rc(<AddResidentModal {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Maria');
    fireEvent.press(screen.getByText('Feminino'));
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() =>
      expect(m.census.addResident).toHaveBeenCalledWith(expect.objectContaining({ gender: 'FEMALE' })),
    );
  });
});

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
});
