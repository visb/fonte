import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { QueryClientProvider } from '@tanstack/react-query';
import { Modal } from 'react-native';
import { ADMISSION_DATE_MESSAGES, maxBirthDateFor, MIN_AGE_MESSAGE, todayInSaoPaulo } from '@fonte/types';
import { createTestQueryClient, expectIdempotencyKey } from '@/lib/test/utils';

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
    residents: { uploadPhoto: jest.fn(), update: jest.fn() },
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

beforeEach(() => jest.clearAllMocks());

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
    rc(<AddResidentModal {...props} />);
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
    rc(<AddResidentModal {...props} onSuccess={onSuccess} onClose={onClose} />);
    // foto
    fireEvent.press(screen.getByText('icon:camera-outline'));
    await waitFor(() => expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalled());
    // campos
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Carlos');
    fireEvent.changeText(screen.getByPlaceholderText('000.000.000-00'), '11122233344');
    fireEvent.changeText(screen.getByPlaceholderText('Número do RG'), 'MG123');
    fireEvent.changeText(screen.getByPlaceholderText('Brasileira'), 'Boliviana');
    // abre os date pickers (cobre os onPress dos campos de data)
    fireEvent.press(screen.getAllByText('icon:calendar-outline')[0]);
    fireEvent.press(screen.getAllByText('icon:calendar-outline')[1]);
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() =>
      expect(m.census.addResident).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Carlos', cpf: '11122233344', rg: 'MG123', nationality: 'Boliviana' }),
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
    rc(<AddResidentModal {...props} />);
    fireEvent.press(screen.getByText('icon:camera-outline'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Permissão necessária', expect.any(String)));
    expect(ImagePicker.launchImageLibraryAsync).not.toHaveBeenCalled();
  });

  it('seleção de foto cancelada não define foto', async () => {
    (ImagePicker.requestMediaLibraryPermissionsAsync as jest.Mock).mockResolvedValue({ status: 'granted' });
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({ canceled: true, assets: [] });
    rc(<AddResidentModal {...props} />);
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
    rc(<AddResidentModal {...props} />);
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
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Menor');
    const minor = `${Number(todayInSaoPaulo().slice(0, 4)) - 10}-01-01`;
    pickBirthDate(minor);
    fireEvent.press(screen.getByText('Adicionar'));

    await waitFor(() => expect(screen.getByText(MIN_AGE_MESSAGE)).toBeTruthy());
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
    rc(<AddResidentModal {...props} />);
    // abre e fecha cada picker (onClose dos dois campos de data)
    fireEvent.press(screen.getAllByText('icon:calendar-outline')[0]);
    fireEvent.press(screen.getAllByText('icon:calendar-outline')[1]);
    for (const p of mockPickerProps.filter((x) => x.visible)) {
      act(() => (p as unknown as { onClose: () => void }).onClose());
    }
    expect(mockPickerProps[mockPickerProps.length - 1].visible).toBe(false);
    // onShow do Modal reinicia o formulário
    fireEvent.press(screen.getByText('Feminino'));
    fireEvent(screen.UNSAFE_getByType(Modal), 'show');
    fireEvent.press(screen.getByText('Masculino'));
    expect(screen.getByText('Masculino')).toBeTruthy();
  });

  it('nascimento de adulto: enfileira como hoje, com a data', async () => {
    m.census.addResident.mockResolvedValue({ id: 'r1' });
    rc(<AddResidentModal {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Adulto');
    pickBirthDate('1980-05-05');
    fireEvent.press(screen.getByText('Adicionar'));

    await waitFor(() =>
      expect(m.census.addResident).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'Adulto', birthDate: '1980-05-05' }),
        expectIdempotencyKey,
      ),
    );
    expect(screen.queryByText(MIN_AGE_MESSAGE)).toBeNull();
  });

  it('erro ao criar mostra Alert', async () => {
    const { Alert } = require('react-native');
    jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    m.census.addResident.mockRejectedValue(new Error('falhou'));
    rc(<AddResidentModal {...props} />);
    fireEvent.changeText(screen.getByPlaceholderText('Nome completo'), 'Zé');
    fireEvent.press(screen.getByText('Adicionar'));
    await waitFor(() => expect(Alert.alert).toHaveBeenCalledWith('Erro', expect.any(String)));
  });
});
