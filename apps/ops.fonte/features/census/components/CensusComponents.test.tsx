import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Modal } from 'react-native';
import {
  ADMISSION_DATE_MESSAGES,
  INVALID_CPF_MESSAGE,
  maxBirthDateFor,
  RESIDENT_CPF_IN_USE_CODE,
  todayInSaoPaulo,
} from '@fonte/types';
import { createTestQueryClient, expectIdempotencyKey } from '@/lib/test/utils';
import { OUTBOX_MUTATION_KEYS } from '@/lib/offline/outbox';
import { ADD_RESIDENT_DATE_MESSAGES } from '../lib/addResidentSchema';

let mockOnline = true;
jest.mock('@/lib/offline/network', () => ({
  ...jest.requireActual('@/lib/offline/network'),
  useIsOnline: () => mockOnline,
}));

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('expo-image-picker', () => ({
  requestMediaLibraryPermissionsAsync: jest.fn(),
  launchImageLibraryAsync: jest.fn(),
  MediaTypeOptions: { Images: 'Images' },
}));
// Guarda as props de cada render do picker para o teste escolher uma data
// (story 202: nascimento de menor/adulto) sem depender do calendário real.
const mockPickerProps: Array<{
  visible: boolean;
  maximumDate?: string;
  onChange: (date: string) => void;
}> = [];
jest.mock('@/components/DatePickerModal', () => ({
  DatePickerModal: (props: (typeof mockPickerProps)[number]) => {
    mockPickerProps.push(props);
    return null;
  },
}));
jest.mock('@/lib/api', () => ({
  api: {
    residents: { uploadPhoto: jest.fn(), update: jest.fn(), lookup: jest.fn(), readmit: jest.fn() },
    houses: { list: jest.fn() },
    census: { addResident: jest.fn() },
  },
  resolveAssetUrl: (u: string | null) => u,
}));

import * as ImagePicker from 'expo-image-picker';
import { api } from '@/lib/api';
import { CensusListItem } from './CensusListItem';
import { ConcludeCensusModal } from './ConcludeCensusModal';
import { AddResidentModal } from './AddResidentModal';

const m = api as unknown as { residents: Record<string, jest.Mock>; houses: Record<string, jest.Mock>; census: Record<string, jest.Mock> };

function rc(ui: React.ReactElement) {
  return render(<QueryClientProvider client={createTestQueryClient()}>{ui}</QueryClientProvider>);
}

/** Story 218: o modal começa pela pergunta — "Não" leva ao cadastro novo de sempre. */
function openForm() {
  fireEvent.press(screen.getByText('Não, é a primeira vez'));
}

function rcForm(ui: React.ReactElement) {
  const result = rc(ui);
  openForm();
  return result;
}

beforeEach(() => {
  jest.clearAllMocks();
  mockOnline = true;
});

describe('CensusListItem', () => {
  const resident = { id: 'r1', name: 'João', photoThumbUrl: 'https://x/t.jpg' };

  function setup(overrides: Record<string, unknown> = {}) {
    const handlers = {
      onConfirm: jest.fn(),
      onRemove: jest.fn(),
      onOpenDetails: jest.fn(),
      onOpenPhoto: jest.fn(),
    };
    render(
      <CensusListItem resident={resident} confirmed={false} {...handlers} {...overrides} />,
    );
    return handlers;
  }

  it('confirma e remove disparam os callbacks', () => {
    const { onConfirm, onRemove } = setup();
    expect(screen.getByText('João')).toBeTruthy();
    fireEvent.press(screen.getByText('icon:checkmark'));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.press(screen.getByText('icon:trash-outline'));
    expect(onRemove).toHaveBeenCalled();
  });

  it('pending mostra badge de aprovação e check fixo (sem onConfirm)', () => {
    const { onConfirm, onOpenDetails } = setup({ pending: true });
    expect(screen.getByText('Aguardando aprovação')).toBeTruthy();
    // o check existe mas é fixo (View, não TouchableOpacity) → onConfirm não dispara
    fireEvent.press(screen.getByText('icon:checkmark'));
    expect(onConfirm).not.toHaveBeenCalled();
    // detalhes seguem acessíveis para o filho adicionado na contagem
    fireEvent.press(screen.getByLabelText('Detalhes de João'));
    expect(onOpenDetails).toHaveBeenCalled();
  });

  // Story 179: dois alvos de toque, um para cada intenção.
  it('toque na foto abre só a foto', () => {
    const { onOpenPhoto, onOpenDetails } = setup();
    fireEvent.press(screen.getByLabelText('Ver foto de João'));
    expect(onOpenPhoto).toHaveBeenCalledTimes(1);
    expect(onOpenDetails).not.toHaveBeenCalled();
  });

  it('toque no nome abre só os detalhes', () => {
    const { onOpenPhoto, onOpenDetails } = setup();
    fireEvent.press(screen.getByLabelText('Detalhes de João'));
    expect(onOpenDetails).toHaveBeenCalledTimes(1);
    expect(onOpenPhoto).not.toHaveBeenCalled();
  });

  // Regressão que protege a contagem: mirar num botão não pode abrir modal.
  it('confirmar e remover não abrem nenhum modal', () => {
    const { onConfirm, onRemove, onOpenDetails, onOpenPhoto } = setup();
    fireEvent.press(screen.getByLabelText('Confirmar João'));
    fireEvent.press(screen.getByLabelText('Remover João'));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onRemove).toHaveBeenCalledTimes(1);
    expect(onOpenDetails).not.toHaveBeenCalled();
    expect(onOpenPhoto).not.toHaveBeenCalled();
  });

  it('filho sem foto: alvo da foto desabilitado, detalhes seguem ativos', () => {
    const { onOpenPhoto, onOpenDetails } = setup({ resident: { id: 'r2', name: 'Ana' } });
    const photoTarget = screen.getByLabelText('Ver foto de Ana');
    expect(photoTarget.props.accessibilityState?.disabled).toBe(true);
    fireEvent.press(photoTarget);
    expect(onOpenPhoto).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Detalhes de Ana'));
    expect(onOpenDetails).toHaveBeenCalled();
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
    rcForm(<AddResidentModal {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Novo Filho');
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() =>
      expect(m.census.addResident).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Novo Filho', houseId: 'h1', gender: 'MALE' }),
        expectIdempotencyKey,
      ),
    );
  });

  it('nome vazio mostra erro de validação e não cria', async () => {
    rcForm(<AddResidentModal {...props} />);
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() => expect(screen.getByText('Informe o nome')).toBeTruthy());
    expect(m.census.addResident).not.toHaveBeenCalled();
  });

  it('alterna o gênero para Feminino', async () => {
    m.census.addResident.mockResolvedValue({ id: 'r1' });
    rcForm(<AddResidentModal {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Maria');
    fireEvent.press(screen.getByText('Feminino'));
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() =>
      expect(m.census.addResident).toHaveBeenCalledWith(
        expect.objectContaining({ gender: 'FEMALE' }),
        expectIdempotencyKey,
      ),
    );
  });

  it('preenche CPF/RG/nacionalidade e envia com foto selecionada', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: false,
      assets: [{ uri: 'file://f.jpg', mimeType: 'image/jpeg' }],
    });
    m.census.addResident.mockResolvedValue({ id: 'r1' });
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    rcForm(<AddResidentModal {...props} onSuccess={onSuccess} onClose={onClose} />);
    // foto
    fireEvent.press(screen.getByText('icon:camera-outline'));
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    // campos
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Carlos');
    // Story 219: CPF válido; a máscara aparece na digitação e o payload vai em dígitos.
    fireEvent.changeText(screen.getByPlaceholderText('000.000.000-00'), '52998224725');
    expect(screen.getByPlaceholderText('000.000.000-00').props.value).toBe('529.982.247-25');
    fireEvent.changeText(screen.getByPlaceholderText('Número do RG'), 'MG123');
    fireEvent.changeText(screen.getByPlaceholderText('Brasileira'), 'Boliviana');
    // abre os date pickers (cobre os onPress dos campos de data)
    fireEvent.press(screen.getAllByText('icon:calendar-outline')[0]);
    fireEvent.press(screen.getAllByText('icon:calendar-outline')[1]);
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() =>
      expect(m.census.addResident).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Carlos', cpf: '52998224725', rg: 'MG123', nationality: 'Boliviana' }),
        expectIdempotencyKey,
      ),
    );
    // foto selecionada → upload separado
    await waitFor(() => expect(m.residents.uploadPhoto).toHaveBeenCalled());
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
  });

  it('sem permissão de galeria alerta e não define foto', async () => {
    const { Alert } = require('react-native');
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'denied' });
    rcForm(<AddResidentModal {...props} />);
    fireEvent.press(screen.getByText('icon:camera-outline'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Permissão necessária', expect.any(String)));
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('seleção de foto cancelada não define foto', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });
    rcForm(<AddResidentModal {...props} />);
    fireEvent.press(screen.getByText('icon:camera-outline'));
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    // continua mostrando o ícone da câmera (sem Image de preview)
    expect(screen.getByText('icon:camera-outline')).toBeTruthy();
  });

  // ── Story 202: nascimento só de maiores de 18 ───────────────────────────────

  /** Abre o picker de nascimento e escolhe `date` nele. */
  function pickBirthDate(date: string) {
    fireEvent.press(screen.getAllByText('icon:calendar-outline')[1]);
    const birthPicker = [...mockPickerProps].reverse().find((p) => p.visible && p.maximumDate);
    expect(birthPicker).toBeDefined();
    act(() => birthPicker!.onChange(date));
    return birthPicker!;
  }

  it('picker de nascimento bloqueia datas depois de hoje − 18 anos', () => {
    mockPickerProps.length = 0;
    rcForm(<AddResidentModal {...props} />);
    const picker = pickBirthDate('1980-01-01');
    expect(picker.maximumDate).toBe(maxBirthDateFor(todayInSaoPaulo()));
  });

  it('nascimento de menor: erro no campo e nada enfileirado', async () => {
    const client = createTestQueryClient();
    render(
      <QueryClientProvider client={client}>
        <AddResidentModal {...props} />
      </QueryClientProvider>,
    );
    openForm();
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Menor');
    const minor = `${Number(todayInSaoPaulo().slice(0, 4)) - 10}-01-01`;
    pickBirthDate(minor);
    fireEvent.press(screen.getByText('Adicionar'));

    // Story 209: a maioridade passou a ser na data de acolhimento.
    await waitFor(() => expect(screen.getByText(ADD_RESIDENT_DATE_MESSAGES.adultAtEntry)).toBeTruthy());
    expect(m.census.addResident).not.toHaveBeenCalled();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });

  // ── Story 203: data de acolhimento não pode ser futura ────────────────────
  it('picker de acolhimento limita a hoje; data futura → erro e nada enfileirado', async () => {
    mockPickerProps.length = 0;
    const client = createTestQueryClient();
    render(
      <QueryClientProvider client={client}>
        <AddResidentModal {...props} />
      </QueryClientProvider>,
    );
    openForm();
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Futuro');
    fireEvent.press(screen.getAllByText('icon:calendar-outline')[0]);
    const entryPicker = [...mockPickerProps].reverse().find((p) => p.visible)!;
    expect(entryPicker.maximumDate).toBe(todayInSaoPaulo());
    act(() => entryPicker.onChange('2999-01-01'));
    fireEvent.press(screen.getByText('Adicionar'));

    await waitFor(() => expect(screen.getByText(ADMISSION_DATE_MESSAGES.entryFuture)).toBeTruthy());
    expect(m.census.addResident).not.toHaveBeenCalled();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });

  it('fechar os pickers, reabrir o modal e voltar ao gênero masculino', () => {
    mockPickerProps.length = 0;
    rcForm(<AddResidentModal {...props} />);
    // abre e fecha cada picker (onClose dos dois campos de data)
    fireEvent.press(screen.getAllByText('icon:calendar-outline')[0]);
    fireEvent.press(screen.getAllByText('icon:calendar-outline')[1]);
    for (const p of mockPickerProps.filter((x) => x.visible)) {
      act(() => (p as unknown as { onClose: () => void }).onClose());
    }
    expect(mockPickerProps[mockPickerProps.length - 1].visible).toBe(false);
    // onShow do Modal volta à pergunta e o formulário recomeça (story 218)
    fireEvent.press(screen.getByText('Feminino'));
    fireEvent(screen.UNSAFE_getByType(Modal), 'show');
    expect(screen.getByText('Este filho já passou pela Fonte de Misericórdia antes?')).toBeTruthy();
    openForm();
    fireEvent.press(screen.getByText('Masculino'));
    expect(screen.getByText('Masculino')).toBeTruthy();
  });

  it('nascimento de adulto: enfileira como hoje, com a data', async () => {
    m.census.addResident.mockResolvedValue({ id: 'r1' });
    rcForm(<AddResidentModal {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Adulto');
    pickBirthDate('1980-05-05');
    fireEvent.press(screen.getByText('Adicionar'));

    await waitFor(() =>
      expect(m.census.addResident).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Adulto', birthDate: '1980-05-05' }),
        expectIdempotencyKey,
      ),
    );
    expect(screen.queryByText(ADD_RESIDENT_DATE_MESSAGES.adultAtEntry)).toBeNull();
  });

  // ── Story 209: datas digitáveis ───────────────────────────────────────────
  describe('datas digitadas (story 209)', () => {
    const typeDate = (label: string, digits: string) =>
      fireEvent.changeText(screen.getByLabelText(label), digits);
    const entryLabel = 'Data de acolhimento';
    const birthLabel = 'Data de nascimento';

    function renderWithClient() {
      const client = createTestQueryClient();
      render(
        <QueryClientProvider client={client}>
          <AddResidentModal {...props} />
        </QueryClientProvider>,
      );
      openForm();
      fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Digitado');
      return client;
    }

    it('acolhimento vem preenchido com hoje (dd/mm/aaaa)', () => {
      rcForm(<AddResidentModal {...props} />);
      const [y, mo, d] = todayInSaoPaulo().split('-');
      expect(screen.getByLabelText(entryLabel).props.value).toBe(`${d}/${mo}/${y}`);
    });

    it('submit com datas digitadas manda a ISO certa', async () => {
      m.census.addResident.mockResolvedValue({ id: 'r1' });
      renderWithClient();
      typeDate(entryLabel, '10012026');
      typeDate(birthLabel, '05031985');
      expect(screen.getByLabelText(birthLabel).props.value).toBe('05/03/1985');
      fireEvent.press(screen.getByText('Adicionar'));
      await waitFor(() =>
        expect(m.census.addResident).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'Digitado', entryDate: '2026-01-10', birthDate: '1985-03-05' }),
          expectIdempotencyKey,
        ),
      );
    });

    it('acolhimento futuro digitado → erro e nada enfileirado', async () => {
      const client = renderWithClient();
      typeDate(entryLabel, '01012999');
      fireEvent.press(screen.getByText('Adicionar'));
      await waitFor(() => expect(screen.getByText(ADMISSION_DATE_MESSAGES.entryFuture)).toBeTruthy());
      expect(client.getMutationCache().getAll()).toHaveLength(0);
    });

    it('nascimento futuro digitado → erro', async () => {
      renderWithClient();
      typeDate(birthLabel, '01012999');
      fireEvent.press(screen.getByText('Adicionar'));
      await waitFor(() => expect(screen.getByText(ADD_RESIDENT_DATE_MESSAGES.birthFuture)).toBeTruthy());
      expect(m.census.addResident).not.toHaveBeenCalled();
    });

    it('nascimento depois do acolhimento → erro', async () => {
      renderWithClient();
      typeDate(entryLabel, '10012026');
      typeDate(birthLabel, '01022026');
      fireEvent.press(screen.getByText('Adicionar'));
      await waitFor(() => expect(screen.getByText(ADD_RESIDENT_DATE_MESSAGES.birthAfterEntry)).toBeTruthy());
      expect(m.census.addResident).not.toHaveBeenCalled();
    });

    it('data inválida (31/02) no nascimento → erro, não vira "sem nascimento"', async () => {
      const client = renderWithClient();
      typeDate(birthLabel, '31021980');
      fireEvent.press(screen.getByText('Adicionar'));
      await waitFor(() => expect(screen.getByText(ADD_RESIDENT_DATE_MESSAGES.invalid)).toBeTruthy());
      expect(client.getMutationCache().getAll()).toHaveLength(0);
    });

    it('acolhimento incompleto → erro de data inválida', async () => {
      renderWithClient();
      typeDate(entryLabel, '1001');
      fireEvent.press(screen.getByText('Adicionar'));
      await waitFor(() => expect(screen.getByText(ADD_RESIDENT_DATE_MESSAGES.invalid)).toBeTruthy());
      expect(m.census.addResident).not.toHaveBeenCalled();
    });

    it('apagar o acolhimento → obrigatório', async () => {
      renderWithClient();
      typeDate(entryLabel, '');
      fireEvent.press(screen.getByText('Adicionar'));
      await waitFor(() => expect(screen.getByText(ADD_RESIDENT_DATE_MESSAGES.entryRequired)).toBeTruthy());
    });

    it('17 anos e 364 dias no acolhimento → erro; 18 exatos → aceito', async () => {
      m.census.addResident.mockResolvedValue({ id: 'r1' });
      renderWithClient();
      typeDate(entryLabel, '10012026');
      typeDate(birthLabel, '11012008');
      fireEvent.press(screen.getByText('Adicionar'));
      await waitFor(() => expect(screen.getByText(ADD_RESIDENT_DATE_MESSAGES.adultAtEntry)).toBeTruthy());
      expect(m.census.addResident).not.toHaveBeenCalled();

      typeDate(birthLabel, '10012008');
      fireEvent.press(screen.getByText('Adicionar'));
      await waitFor(() =>
        expect(m.census.addResident).toHaveBeenCalledWith(
          expect.objectContaining({ entryDate: '2026-01-10', birthDate: '2008-01-10' }),
          expectIdempotencyKey,
        ),
      );
    });

    it('acolhimento retroativo: o calendário de nascimento limita a 18 anos antes dele', () => {
      mockPickerProps.length = 0;
      rcForm(<AddResidentModal {...props} />);
      typeDate(entryLabel, '10012026');
      fireEvent.press(screen.getByLabelText(`Abrir calendário: ${birthLabel}`));
      const birthPicker = [...mockPickerProps].reverse().find((p) => p.visible)!;
      expect(birthPicker.maximumDate).toBe('2008-01-10');
    });

    it('sem sinal: datas digitadas entram na fila com o payload de sempre', async () => {
      const { Alert } = require('react-native');
      jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
      mockOnline = false;
      const client = renderWithClient();
      typeDate(entryLabel, '10012026');
      typeDate(birthLabel, '05031985');
      fireEvent.press(screen.getByText('Adicionar'));
      await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(1));
      const mutation = client.getMutationCache().getAll()[0];
      expect(mutation.options.mutationKey).toEqual(OUTBOX_MUTATION_KEYS.censusAddResident);
      expect(mutation.state.variables).toMatchObject({
        data: expect.objectContaining({ entryDate: '2026-01-10', birthDate: '1985-03-05' }),
      });
    });
  });

  it('erro ao criar mostra Alert', async () => {
    const { Alert } = require('react-native');
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    m.census.addResident.mockRejectedValue(new Error('falhou'));
    rcForm(<AddResidentModal {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Zé');
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Erro', expect.any(String)));
  });

  // ── Story 219: CPF do filho único ─────────────────────────────────────────
  it('CPF com DV inválido → erro no campo e nada enfileirado', async () => {
    const client = createTestQueryClient();
    render(
      <QueryClientProvider client={client}>
        <AddResidentModal {...props} />
      </QueryClientProvider>,
    );
    openForm();
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'CPF Ruim');
    fireEvent.changeText(screen.getByPlaceholderText('000.000.000-00'), '11111111111');
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() => expect(screen.getByText(INVALID_CPF_MESSAGE)).toBeTruthy());
    expect(m.census.addResident).not.toHaveBeenCalled();
    expect(client.getMutationCache().getAll()).toHaveLength(0);
  });

  it('409 de CPF em uso → alerta com a mensagem do servidor (nome e status do dono)', async () => {
    const { Alert } = require('react-native');
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    m.census.addResident.mockRejectedValue({
      response: {
        status: 409,
        data: {
          code: RESIDENT_CPF_IN_USE_CODE,
          message: 'Já existe um filho com este CPF: Bruno (Alta).',
          conflictResidentId: 'r9',
        },
      },
    });
    // Story 218: o dono não aparece entre os candidatos → só o alerta.
    m.residents.lookup.mockResolvedValue([]);
    rcForm(<AddResidentModal {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Bruno de novo');
    fireEvent.changeText(screen.getByPlaceholderText('000.000.000-00'), '529.982.247-25');
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Já existe um filho com este CPF: Bruno (Alta).'),
    );
    expect(m.census.addResident).toHaveBeenCalledWith(
      expect.objectContaining({ cpf: '52998224725' }),
      expectIdempotencyKey,
    );
  });
});

// ── Story 218: "já passou pela comunidade?" + reacolhimento ────────────────
describe('AddResidentModal — reacolhimento (story 218)', () => {
  const props = { visible: true, houseId: 'h1', onClose: jest.fn(), onSuccess: jest.fn() };
  const candidate = {
    id: 'r9',
    name: 'Pedro Arquivado',
    birthDate: '1990-01-02',
    photoUrl: null,
    status: 'ARCHIVED',
    lastHouseName: 'Casa Sede',
    lastExitDate: '2024-05-01',
  };
  const today = todayInSaoPaulo();
  const { Alert } = require('react-native');

  beforeEach(() => {
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
  });

  function search(term: string) {
    fireEvent.press(screen.getByText('Sim'));
    fireEvent.changeText(screen.getByLabelText('Nome ou CPF'), term);
    fireEvent.press(screen.getByText('Buscar'));
  }

  async function chooseCandidate() {
    m.residents.lookup.mockResolvedValue([candidate]);
    search('pedro');
    fireEvent.press(await screen.findByLabelText('Candidato Pedro Arquivado'));
  }

  it('Sim → busca → escolhe → confirma: readmit com casa da contagem e data de entrada', async () => {
    m.residents.readmit.mockResolvedValue({ id: 'r9' });
    const onSuccess = jest.fn();
    const onClose = jest.fn();
    rc(<AddResidentModal {...props} onSuccess={onSuccess} onClose={onClose} />);
    await chooseCandidate();

    expect(m.residents.lookup).toHaveBeenCalledWith('pedro');
    expect(screen.getByText('Reacolher filho')).toBeTruthy();
    expect(screen.getByText(/Última casa: Casa Sede/)).toBeTruthy();
    fireEvent.press(screen.getByText('Reacolher'));

    await waitFor(() =>
      expect(m.residents.readmit).toHaveBeenCalledWith(
        'r9',
        { houseId: 'h1', entryDate: today },
        expectIdempotencyKey,
      ),
    );
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    expect(onClose).toHaveBeenCalled();
    expect(m.census.addResident).not.toHaveBeenCalled();
  });

  it('"Não é nenhum destes" → cadastro novo com o nome digitado', async () => {
    m.residents.lookup.mockResolvedValue([candidate]);
    rc(<AddResidentModal {...props} />);
    search('Pedro Silva');
    fireEvent.press(await screen.findByText('Não é nenhum destes'));
    expect(screen.getByPlaceholderText('Nome completo').props.value).toBe('Pedro Silva');
  });

  it('nenhum resultado por CPF → cadastro novo com o CPF mascarado', async () => {
    m.residents.lookup.mockResolvedValue([]);
    rc(<AddResidentModal {...props} />);
    search('52998224725');
    fireEvent.press(await screen.findByText('Cadastrar como novo'));
    expect(screen.getByPlaceholderText('000.000.000-00').props.value).toBe('529.982.247-25');
    expect(screen.getByPlaceholderText('Nome completo').props.value).toBe('');
  });

  it('termo curto → erro no campo, sem busca', async () => {
    rc(<AddResidentModal {...props} />);
    search('pe');
    await waitFor(() =>
      expect(screen.getByText('Digite ao menos 3 caracteres do nome ou do CPF.')).toBeTruthy(),
    );
    expect(m.residents.lookup).not.toHaveBeenCalled();
  });

  it('falha da busca mostra erro com nova tentativa', async () => {
    m.residents.lookup.mockRejectedValueOnce({ response: { data: { message: 'Falhou a busca' } } });
    rc(<AddResidentModal {...props} />);
    search('pedro');
    expect(await screen.findByText('Falhou a busca')).toBeTruthy();
    m.residents.lookup.mockResolvedValue([candidate]);
    fireEvent.press(screen.getByText('Tentar novamente'));
    expect(await screen.findByLabelText('Candidato Pedro Arquivado')).toBeTruthy();
  });

  it('Voltar: confirmação → busca → pergunta; Fechar fecha o modal', async () => {
    const onClose = jest.fn();
    rc(<AddResidentModal {...props} onClose={onClose} />);
    await chooseCandidate();
    fireEvent.press(screen.getByText('Voltar'));
    expect(screen.getByText('Buscar cadastro')).toBeTruthy();
    fireEvent.press(screen.getByText('Voltar'));
    expect(screen.getByText('Este filho já passou pela Fonte de Misericórdia antes?')).toBeTruthy();
    fireEvent.press(screen.getByLabelText('Fechar'));
    expect(onClose).toHaveBeenCalled();
  });

  it.each([
    ['01012999', ADMISSION_DATE_MESSAGES.entryFuture],
    ['30042024', ADMISSION_DATE_MESSAGES.entryBeforePreviousExit('2024-05-01')],
    ['3004', ADD_RESIDENT_DATE_MESSAGES.invalid],
    ['', ADD_RESIDENT_DATE_MESSAGES.entryRequired],
  ])('data de entrada %s → erro e nada enviado', async (digits, message) => {
    rc(<AddResidentModal {...props} />);
    await chooseCandidate();
    fireEvent.changeText(screen.getByLabelText('Data de entrada'), digits);
    fireEvent.press(screen.getByText('Reacolher'));
    expect(await screen.findByText(message)).toBeTruthy();
    expect(m.residents.readmit).not.toHaveBeenCalled();
  });

  it('entrada no dia da última saída é aceita', async () => {
    m.residents.readmit.mockResolvedValue({ id: 'r9' });
    rc(<AddResidentModal {...props} />);
    await chooseCandidate();
    fireEvent.changeText(screen.getByLabelText('Data de entrada'), '01052024');
    fireEvent.press(screen.getByText('Reacolher'));
    await waitFor(() =>
      expect(m.residents.readmit).toHaveBeenCalledWith(
        'r9',
        { houseId: 'h1', entryDate: '2024-05-01' },
        expectIdempotencyKey,
      ),
    );
  });

  it('rejeição do servidor na hora → alerta com a mensagem', async () => {
    m.residents.readmit.mockRejectedValue({
      response: { status: 400, data: { message: 'Apenas filhos com status Alta…' } },
    });
    rc(<AddResidentModal {...props} />);
    await chooseCandidate();
    fireEvent.press(screen.getByText('Reacolher'));
    await waitFor(() =>
      expect(Alert.alert).toHaveBeenCalledWith('Erro', 'Apenas filhos com status Alta…'),
    );
  });

  it('sinal caiu depois de entrar no fluxo: reacolhimento vai para a fila', async () => {
    const client = createTestQueryClient();
    m.residents.lookup.mockResolvedValue([candidate]);
    render(
      <QueryClientProvider client={client}>
        <AddResidentModal {...props} />
      </QueryClientProvider>,
    );
    m.residents.readmit.mockResolvedValue({ id: 'r9' });
    search('pedro');
    const item = await screen.findByLabelText('Candidato Pedro Arquivado');
    // O sinal cai depois da busca, antes de a confirmação montar.
    mockOnline = false;
    fireEvent.press(item);
    fireEvent.press(screen.getByText('Reacolher'));
    await waitFor(() => expect(client.getMutationCache().getAll()).toHaveLength(1));
    const mutation = client.getMutationCache().getAll()[0];
    expect(mutation.options.mutationKey).toEqual(OUTBOX_MUTATION_KEYS.censusReadmitResident);
    expect(mutation.state.variables).toMatchObject({
      houseId: 'h1',
      residentId: 'r9',
      residentName: 'Pedro Arquivado',
      data: { houseId: 'h1', entryDate: today },
    });
    expect(Alert.alert).toHaveBeenCalledWith('Salvo no aparelho', expect.any(String));
  });

  describe('409 de CPF em uso no cadastro novo (decisão 7)', () => {
    const conflict = {
      response: {
        status: 409,
        data: {
          code: RESIDENT_CPF_IN_USE_CODE,
          message: 'Já existe um filho com este CPF: Pedro Arquivado (Arquivado).',
          conflictResidentId: 'r9',
        },
      },
    };

    function submitWithCpf() {
      rcForm(<AddResidentModal {...props} />);
      fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Pedro de novo');
      fireEvent.changeText(screen.getByPlaceholderText('000.000.000-00'), '52998224725');
      fireEvent.press(screen.getByText('Adicionar'));
    }

    it('dono fora de acolhimento → oferece reacolher e leva à confirmação', async () => {
      m.census.addResident.mockRejectedValue(conflict);
      m.residents.lookup.mockResolvedValue([candidate]);
      submitWithCpf();

      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'CPF já cadastrado',
          expect.stringContaining('reacolher?'),
          expect.any(Array),
        ),
      );
      expect(m.residents.lookup).toHaveBeenCalledWith('52998224725');
      const buttons = (Alert.alert as jest.Mock).mock.calls.at(-1)[2];
      act(() => buttons.find((b: { text: string }) => b.text === 'Reacolher').onPress());
      expect(screen.getByText('Reacolher filho')).toBeTruthy();
      expect(screen.getByText('Pedro Arquivado')).toBeTruthy();
    });

    it('dono em acolhimento (não é candidato) → só o alerta do servidor', async () => {
      m.census.addResident.mockRejectedValue(conflict);
      m.residents.lookup.mockResolvedValue([]);
      submitWithCpf();
      await waitFor(() =>
        expect(Alert.alert).toHaveBeenCalledWith(
          'Erro',
          'Já existe um filho com este CPF: Pedro Arquivado (Arquivado).',
        ),
      );
    });

    it('409 sem id do dono → só o alerta, sem busca', async () => {
      m.census.addResident.mockRejectedValue({
        response: { ...conflict.response, data: { ...conflict.response.data, conflictResidentId: null } },
      });
      submitWithCpf();
      await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Erro', expect.any(String)));
      expect(m.residents.lookup).not.toHaveBeenCalled();
    });
  });
});
