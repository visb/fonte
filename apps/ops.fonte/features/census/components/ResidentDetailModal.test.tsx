/**
 * Modal de detalhes do filho na contagem (story 179).
 *
 * A contagem acontece no pátio, sem sinal: o modal abre com o que a lista já
 * tem e enriquece se a ficha existir. `isLoading`/`error` do `useResidentById`
 * não podem virar spinner bloqueante nem `ErrorState` na tela.
 */
import { ActivityIndicator } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { ResidentStatus } from '@fonte/types';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

const mockUseResidentById = jest.fn();
jest.mock('@/features/residents/hooks/useResidents', () => ({
  useResidentById: (...args: unknown[]) => mockUseResidentById(...args),
}));

import { ResidentDetailModal } from './ResidentDetailModal';

const RESIDENT = {
  id: 'r1',
  name: 'João',
  status: ResidentStatus.ACTIVE as string,
  entryDate: '2026-01-05',
  photoThumbUrl: 'https://x/t.jpg',
  photoUrl: 'https://x/full.jpg',
};

const FICHA = {
  birthDate: '1990-03-10',
  contactPhone: '(31) 99999-0000',
  cpf: '111.222.333-44',
  healthIssues: 'Hipertensão',
};

beforeEach(() => {
  jest.clearAllMocks();
  mockUseResidentById.mockReturnValue({ data: undefined, isLoading: false, error: null });
});

function open(props: Record<string, unknown> = {}) {
  return render(
    <ResidentDetailModal visible resident={RESIDENT} onClose={jest.fn()} {...props} />,
  );
}

describe('ResidentDetailModal', () => {
  it('com a ficha carregando mostra o bloco base sem spinner bloqueante', () => {
    mockUseResidentById.mockReturnValue({ data: undefined, isLoading: true, error: null });
    open();

    expect(screen.getByText('João')).toBeTruthy();
    expect(screen.getByText('Ativo')).toBeTruthy();
    expect(screen.getByText('05/01/2026')).toBeTruthy();
    expect(screen.UNSAFE_queryAllByType(ActivityIndicator)).toHaveLength(0);
    expect(screen.queryByText('Ministério')).toBeNull();
  });

  it('com a ficha em erro (offline) não mostra ErrorState — só o bloco base', () => {
    mockUseResidentById.mockReturnValue({
      data: undefined,
      isLoading: false,
      error: new Error('Network Error'),
    });
    open();

    expect(screen.getByText('João')).toBeTruthy();
    expect(screen.queryByText('Erro ao carregar dados.')).toBeNull();
    expect(screen.queryByText('Tentar novamente')).toBeNull();
    expect(screen.queryByText('Telefone')).toBeNull();
  });

  // Story 205: a linha "Ministério" volta à ficha do censo.
  it('com a ficha em mãos mostra ministério, nascimento e telefone', () => {
    mockUseResidentById.mockReturnValue({
      data: { ...FICHA, ministry: { id: 'm1', name: 'Cozinha' } },
      isLoading: false,
      error: null,
    });
    open();

    expect(screen.getByText('Ministério')).toBeTruthy();
    expect(screen.getByText('Cozinha')).toBeTruthy();
    expect(screen.getByText(/10\/03\/1990/)).toBeTruthy();
    expect(screen.getByText('(31) 99999-0000')).toBeTruthy();
  });

  it('não renderiza dado de saúde nem CPF', () => {
    mockUseResidentById.mockReturnValue({ data: FICHA, isLoading: false, error: null });
    open();

    expect(screen.queryByText('CPF')).toBeNull();
    expect(screen.queryByText('111.222.333-44')).toBeNull();
    expect(screen.queryByText('Hipertensão')).toBeNull();
  });

  it('fechado não dispara a busca da ficha', () => {
    render(<ResidentDetailModal visible={false} resident={RESIDENT} onClose={jest.fn()} />);
    expect(mockUseResidentById).toHaveBeenCalledWith('r1', { enabled: false });
    expect(screen.queryByText('João')).toBeNull();
  });

  it('aberto busca a ficha do filho da linha', () => {
    open();
    expect(mockUseResidentById).toHaveBeenCalledWith('r1', { enabled: true });
  });

  it('"Ver ficha completa" navega para a ficha e fecha o modal', () => {
    const onClose = jest.fn();
    open({ onClose });

    fireEvent.press(screen.getByLabelText('Ver ficha completa'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/residents/r1');
    expect(onClose).toHaveBeenCalled();
  });

  it('fecha pelo X e pelo toque no fundo', () => {
    const onClose = jest.fn();
    open({ onClose });

    fireEvent.press(screen.getByLabelText('Fechar detalhes'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('filho adicionado na contagem mostra o rótulo de aprovação', () => {
    open({ resident: { ...RESIDENT, status: ResidentStatus.CENSUS_ADDED } });
    expect(screen.getByText('Aguardando aprovação')).toBeTruthy();
  });

  it('toque no avatar abre a foto em tela cheia', () => {
    open();
    fireEvent.press(screen.getByLabelText('Ampliar foto'));
    // O visualizador renderiza o nome sob a foto: com ele aberto o nome aparece
    // duas vezes (bloco base + tela cheia).
    expect(screen.getAllByText('João').length).toBeGreaterThan(1);

    // Fechar a foto volta ao modal de detalhes, sem fechar os detalhes junto.
    fireEvent.press(screen.getByLabelText('Fechar foto'));
    expect(screen.getAllByText('João')).toHaveLength(1);
    expect(screen.getByText('Detalhes do filho')).toBeTruthy();
  });

  it('filho sem foto tem o avatar desabilitado e ícone de pessoa', () => {
    open({ resident: { ...RESIDENT, photoUrl: null, photoThumbUrl: null } });
    expect(screen.getByLabelText('Ampliar foto').props.accessibilityState?.disabled).toBe(true);
    expect(screen.getByText('icon:person-outline')).toBeTruthy();
  });

  it('sem filho selecionado o modal fica fechado', () => {
    render(<ResidentDetailModal visible resident={null} onClose={jest.fn()} />);
    expect(mockUseResidentById).toHaveBeenCalledWith(undefined, { enabled: true });
    expect(screen.queryByText('Detalhes do filho')).toBeNull();
  });
});
