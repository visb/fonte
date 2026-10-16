import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { createTestQueryClient, expectIdempotencyKey } from '@/lib/test/utils';

// Story 196: o modal saiu de `features/census/components/` e estes specs vieram
// junto, de `CensusComponents.test.tsx`, SEM mudança de expectativa — a mudança
// é de lugar, não de comportamento.

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
const mockDatePicker = jest.fn();
jest.mock('@/components/DatePickerModal', () => ({
  DatePickerModal: (props: unknown) => {
    mockDatePicker(props);
    return null;
  },
}));
let mockOnline = true;
jest.mock('@/lib/offline/network', () => ({
  ...jest.requireActual('@/lib/offline/network'),
  useIsOnline: () => mockOnline,
}));
jest.mock('@/lib/api', () => ({
  api: {
    residents: { update: jest.fn() },
    houses: { list: jest.fn() },
  },
  resolveAssetUrl: (u: string | null) => u,
}));

import { ADMISSION_DATE_MESSAGES, todayInSaoPaulo } from '@fonte/types';
import { api } from '@/lib/api';
import { OUTBOX_MUTATION_KEYS } from '@/lib/offline/outbox';
import { RemoveResidentModal } from './RemoveResidentModal';

const m = api as unknown as {
  residents: Record<string, jest.Mock>;
  houses: Record<string, jest.Mock>;
};

function rc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
});

type DatePickerProps = { visible: boolean; onChange: (v: string) => void; onClose: () => void };
const lastDatePicker = () => mockDatePicker.mock.calls.at(-1)?.[0] as DatePickerProps;

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

  it('sem mode: título "Remover filho" e as três ações (contagem, story 200)', () => {
    m.houses.list.mockResolvedValue([]);
    rc(<RemoveResidentModal {...props} />);
    expect(screen.getByText('Remover filho')).toBeTruthy();
    expect(screen.getByText('O que deseja fazer?')).toBeTruthy();
    expect(screen.getByText('Declarar alta')).toBeTruthy();
    expect(screen.getByText('Evasão')).toBeTruthy();
    expect(screen.getByText('Transferir para outra casa')).toBeTruthy();
  });

  it('mode="exit": título de saída e só alta e evasão', async () => {
    m.houses.list.mockResolvedValue([]);
    m.residents.update.mockResolvedValue({ id: 'r1' });
    rc(<RemoveResidentModal {...props} mode="exit" />);
    expect(screen.getByText('Declarar saída da comunidade')).toBeTruthy();
    expect(screen.getByText('Declarar alta')).toBeTruthy();
    expect(screen.getByText('Evasão')).toBeTruthy();
    expect(screen.queryByText('Transferir para outra casa')).toBeNull();
    fireEvent.press(screen.getByText('Evasão'));
    fireEvent.press(screen.getByText('Confirmar'));
    await waitFor(() =>
      expect(m.residents.update).toHaveBeenCalledWith(
        'r1',
        expect.objectContaining({ status: 'EVADED', exitDate: expect.any(String) }),
        expectIdempotencyKey,
      ),
    );
  });

  it('mode="exit": sem escolher alta ou evasão, Confirmar não envia', () => {
    m.houses.list.mockResolvedValue([]);
    rc(<RemoveResidentModal {...props} mode="exit" />);
    fireEvent.press(screen.getByText('Confirmar'));
    expect(m.residents.update).not.toHaveBeenCalled();
  });

  it('mode="transfer": só a lista de casas, com a ação já selecionada', async () => {
    m.houses.list.mockResolvedValue([
      { id: 'h1', name: 'Casa Atual' },
      { id: 'h2', name: 'Casa Bethel' },
    ]);
    m.residents.update.mockResolvedValue({ id: 'r1' });
    rc(<RemoveResidentModal {...props} mode="transfer" />);
    expect(screen.getByText('Transferir de casa')).toBeTruthy();
    expect(screen.queryByText('O que deseja fazer?')).toBeNull();
    expect(screen.queryByText('Declarar alta')).toBeNull();
    expect(screen.queryByText('Evasão')).toBeNull();
    expect(screen.queryByText('Transferir para outra casa')).toBeNull();
    expect(screen.queryByText('Data do acontecimento *')).toBeNull();
    await waitFor(() => expect(screen.getByText('Casa Bethel')).toBeTruthy());
    expect(screen.getByText('Casa de destino *')).toBeTruthy();
    expect(screen.queryByText('Casa Atual')).toBeNull();
    fireEvent.press(screen.getByText('Casa Bethel'));
    fireEvent.press(screen.getByText('Confirmar'));
    await waitFor(() =>
      expect(m.residents.update).toHaveBeenCalledWith('r1', { houseId: 'h2' }, expectIdempotencyKey),
    );
  });

  it('sem sinal a baixa entra na fila: fecha na hora e avisa', async () => {
    const { Alert } = require('react-native');
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    mockOnline = false;
    m.houses.list.mockResolvedValue([]);
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    rc(<RemoveResidentModal {...props} mode="exit" onSuccess={onSuccess} onClose={onClose} />);
    fireEvent.press(screen.getByText('Declarar alta'));
    fireEvent.press(screen.getByText('Confirmar'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSuccess).toHaveBeenCalled();
    expect(Alert.alert).toHaveBeenCalledWith('Salvo no aparelho', expect.any(String));
  });

  it('a data do acontecimento abre o seletor e reflete a data escolhida', () => {
    m.houses.list.mockResolvedValue([]);
    rc(<RemoveResidentModal {...props} mode="exit" />);
    fireEvent.press(screen.getByText('Declarar alta'));
    expect(lastDatePicker().visible).toBe(false);
    fireEvent.press(screen.getByText('icon:calendar-outline'));
    expect(lastDatePicker().visible).toBe(true);
    act(() => lastDatePicker().onChange('2026-01-02'));
    expect(screen.getByText('02/01/2026')).toBeTruthy();
    act(() => lastDatePicker().onClose());
    expect(lastDatePicker().visible).toBe(false);
  });

  it('reabrir o modal (onShow) limpa a escolha anterior', () => {
    const { Modal } = require('react-native');
    m.houses.list.mockResolvedValue([]);
    rc(<RemoveResidentModal {...props} />);
    fireEvent.press(screen.getByText('Evasão'));
    expect(screen.getByText('Data do acontecimento *')).toBeTruthy();
    act(() => screen.UNSAFE_getByType(Modal).props.onShow());
    expect(screen.queryByText('Data do acontecimento *')).toBeNull();
    fireEvent.press(screen.getByText('Confirmar'));
    expect(m.residents.update).not.toHaveBeenCalled();
  });

  // ─── Story 203: saída entre a entrada do filho e hoje ──────────────────────
  describe('limites da data de saída (story 203)', () => {
    const withEntry = { ...props, resident: { id: 'r1', name: 'João', entryDate: '2026-03-10T00:00:00.000Z' } };
    const pickDate = (iso: string) => act(() => lastDatePicker().onChange(iso));

    it('DatePickerModal recebe minimumDate = entrada e maximumDate = hoje', () => {
      m.houses.list.mockResolvedValue([]);
      rc(<RemoveResidentModal {...withEntry} mode="exit" />);
      fireEvent.press(screen.getByText('Declarar alta'));
      const picker = lastDatePicker() as DatePickerProps & {
        minimumDate?: string;
        maximumDate?: string;
      };
      expect(picker.minimumDate).toBe('2026-03-10');
      expect(picker.maximumDate).toBe(todayInSaoPaulo());
    });

    it('saída antes da entrada → mensagem, Confirmar desabilitado e nada enfileirado', () => {
      mockOnline = false;
      m.houses.list.mockResolvedValue([]);
      const client = createTestQueryClient();
      render(
        <QueryClientProvider client={client}>
          <RemoveResidentModal {...withEntry} mode="exit" />
        </QueryClientProvider>,
      );
      fireEvent.press(screen.getByText('Declarar alta'));
      pickDate('2026-03-09');
      expect(
        screen.getByText(ADMISSION_DATE_MESSAGES.exitBeforeEntry('2026-03-10')),
      ).toBeTruthy();
      fireEvent.press(screen.getByText('Confirmar'));
      expect(client.getMutationCache().getAll()).toHaveLength(0);
      expect(m.residents.update).not.toHaveBeenCalled();
    });

    it('saída futura → mensagem e nada enviado', () => {
      m.houses.list.mockResolvedValue([]);
      rc(<RemoveResidentModal {...withEntry} mode="exit" />);
      fireEvent.press(screen.getByText('Evasão'));
      pickDate('2999-01-01');
      expect(screen.getByText(ADMISSION_DATE_MESSAGES.exitFuture)).toBeTruthy();
      fireEvent.press(screen.getByText('Confirmar'));
      expect(m.residents.update).not.toHaveBeenCalled();
    });

    it('data válida (mesmo dia da entrada) enfileira com a mesma mutationKey e payload', async () => {
      const { Alert } = require('react-native');
      jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      mockOnline = false;
      m.houses.list.mockResolvedValue([]);
      const client = createTestQueryClient();
      render(
        <QueryClientProvider client={client}>
          <RemoveResidentModal {...withEntry} mode="exit" />
        </QueryClientProvider>,
      );
      fireEvent.press(screen.getByText('Declarar alta'));
      pickDate('2026-03-10');
      fireEvent.press(screen.getByText('Confirmar'));
      await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(1));
      const mutation = client.getMutationCache().getAll()[0];
      expect(mutation.options.mutationKey).toEqual(OUTBOX_MUTATION_KEYS.residentUpdateStatus);
      expect(mutation.state.variables).toMatchObject({
        houseId: 'h1',
        residentId: 'r1',
        data: { status: 'DISCHARGED', exitDate: '2026-03-10' },
      });
    });

    it('sem entrada conhecida (contagem antiga) só vale o limite de hoje', () => {
      m.houses.list.mockResolvedValue([]);
      rc(<RemoveResidentModal {...props} mode="exit" />);
      fireEvent.press(screen.getByText('Declarar alta'));
      const picker = lastDatePicker() as DatePickerProps & { minimumDate?: string };
      expect(picker.minimumDate).toBeUndefined();
      pickDate('2001-01-01');
      expect(screen.queryByText(/não pode/)).toBeNull();
    });
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
