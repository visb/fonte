import { fireEvent, render, screen } from '@testing-library/react-native';
import { FollowUpType, ResidentStatus } from '@fonte/types';

// @expo/vector-icons depende de fontes nativas: stub leve.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

// expo-router: captura navegação.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

import { ResidentListItem } from './ResidentListItem';
import { ResidentSearchBar } from './ResidentSearchBar';
import { ResidentStatusFilterModal } from './ResidentStatusFilterModal';
import { TrackingEventItem } from './TrackingEventItem';
import { ResidentPhoto } from './ResidentPhoto';

beforeEach(() => jest.clearAllMocks());

describe('ResidentListItem', () => {
  const item = { id: 'r1', name: 'João Silva', status: 'ACTIVE' };

  it('mostra nome e label do status (Ativo) e ícone de pessoa sem foto', () => {
    render(<ResidentListItem item={item} />);
    expect(screen.getByText('João Silva')).toBeTruthy();
    expect(screen.getByText('Ativo')).toBeTruthy();
    expect(screen.getByText('icon:person-outline')).toBeTruthy();
  });

  it('renderiza a foto (sem ícone) quando há thumb', () => {
    render(<ResidentListItem item={{ ...item, photoThumbUrl: 'https://x/t.jpg' }} />);
    expect(screen.queryByText('icon:person-outline')).toBeNull();
  });

  it('status desconhecido cai no fallback (mostra o código cru)', () => {
    render(<ResidentListItem item={{ ...item, status: 'WEIRD' }} />);
    expect(screen.getByText('WEIRD')).toBeTruthy();
  });

  it('toca navega para o detalhe do residente', () => {
    render(<ResidentListItem item={item} />);
    fireEvent.press(screen.getByText('João Silva'));
    expect(mockPush).toHaveBeenCalledWith('/(app)/residents/r1');
  });
});

describe('ResidentSearchBar', () => {
  const baseProps = {
    value: '',
    onChangeText: jest.fn(),
    onClear: jest.fn(),
    onPressFilter: jest.fn(),
    filterActive: false,
  };

  it('dispara onChangeText ao digitar', () => {
    const onChangeText = jest.fn();
    render(<ResidentSearchBar {...baseProps} onChangeText={onChangeText} />);
    fireEvent.changeText(screen.getByPlaceholderText('Buscar filho...'), 'jo');
    expect(onChangeText).toHaveBeenCalledWith('jo');
  });

  it('sem valor não mostra o botão de limpar', () => {
    render(<ResidentSearchBar {...baseProps} value="" />);
    expect(screen.queryByText('icon:close-circle')).toBeNull();
  });

  it('com valor mostra limpar e dispara onClear', () => {
    const onClear = jest.fn();
    render(<ResidentSearchBar {...baseProps} value="jo" onClear={onClear} />);
    fireEvent.press(screen.getByText('icon:close-circle'));
    expect(onClear).toHaveBeenCalled();
  });

  it('botão de filtro dispara onPressFilter', () => {
    const onPressFilter = jest.fn();
    render(<ResidentSearchBar {...baseProps} onPressFilter={onPressFilter} />);
    fireEvent.press(screen.getByText('icon:options-outline'));
    expect(onPressFilter).toHaveBeenCalled();
  });
});

describe('ResidentStatusFilterModal', () => {
  const baseProps = {
    visible: true,
    onClose: jest.fn(),
    value: [ResidentStatus.ACTIVE],
    onApply: jest.fn(),
  };

  it('renderiza as opções de status', () => {
    render(<ResidentStatusFilterModal {...baseProps} />);
    expect(screen.getByText('Filtrar por status')).toBeTruthy();
    expect(screen.getByText('Ativo')).toBeTruthy();
    expect(screen.getByText('Disciplina')).toBeTruthy();
  });

  it('aplicar devolve a seleção atual (valor inicial)', () => {
    const onApply = jest.fn();
    render(<ResidentStatusFilterModal {...baseProps} onApply={onApply} />);
    fireEvent.press(screen.getByText('Aplicar'));
    expect(onApply).toHaveBeenCalledWith([ResidentStatus.ACTIVE]);
  });

  it('toggla um status e aplica a nova seleção', () => {
    const onApply = jest.fn();
    render(<ResidentStatusFilterModal {...baseProps} onApply={onApply} />);
    fireEvent.press(screen.getByText('Disciplina'));
    fireEvent.press(screen.getByText('Aplicar'));
    expect(onApply).toHaveBeenCalledWith([ResidentStatus.ACTIVE, ResidentStatus.DISCIPLINE]);
  });

  it('destogla um status já selecionado', () => {
    const onApply = jest.fn();
    render(<ResidentStatusFilterModal {...baseProps} onApply={onApply} />);
    fireEvent.press(screen.getByText('Ativo'));
    fireEvent.press(screen.getByText('Aplicar'));
    expect(onApply).toHaveBeenCalledWith([]);
  });

  it('Restaurar volta ao filtro padrão (ACTIVE)', () => {
    const onApply = jest.fn();
    render(
      <ResidentStatusFilterModal
        {...baseProps}
        value={[ResidentStatus.ACTIVE, ResidentStatus.EVADED]}
        onApply={onApply}
      />,
    );
    fireEvent.press(screen.getByText('Restaurar'));
    fireEvent.press(screen.getByText('Aplicar'));
    expect(onApply).toHaveBeenCalledWith([ResidentStatus.ACTIVE]);
  });

  it('fechar dispara onClose', () => {
    const onClose = jest.fn();
    render(<ResidentStatusFilterModal {...baseProps} onClose={onClose} />);
    fireEvent.press(screen.getByText('icon:close'));
    expect(onClose).toHaveBeenCalled();
  });
});

describe('TrackingEventItem', () => {
  function makeFollowUp(overrides = {}) {
    return {
      id: 'f1',
      type: FollowUpType.NOTE,
      date: '2026-03-10',
      description: 'Observação importante',
      createdByName: 'Servo X',
      ...overrides,
    } as never;
  }

  it('mostra o label do tipo, descrição e autor', () => {
    render(<TrackingEventItem followUp={makeFollowUp()} />);
    expect(screen.getByText('Observação')).toBeTruthy();
    expect(screen.getByText('Observação importante')).toBeTruthy();
    expect(screen.getByText(/Servo X/)).toBeTruthy();
  });

  it('sem descrição não renderiza o parágrafo de descrição', () => {
    render(<TrackingEventItem followUp={makeFollowUp({ description: null })} />);
    expect(screen.queryByText('Observação importante')).toBeNull();
  });

  it('sem autor não acrescenta o sufixo de nome', () => {
    render(<TrackingEventItem followUp={makeFollowUp({ createdByName: null })} />);
    // a data aparece sem " · autor"
    expect(screen.queryByText(/·/)).toBeNull();
  });
});

describe('ResidentPhoto', () => {
  it('sem foto mostra ícone de pessoa e não abre o modal (disabled)', () => {
    render(<ResidentPhoto name="João" />);
    expect(screen.getByText('icon:person-outline')).toBeTruthy();
  });

  it('com foto abre o modal de visualização ao tocar', () => {
    render(<ResidentPhoto name="João" photoUrl="https://x/full.jpg" photoThumbUrl="https://x/t.jpg" />);
    // toca na miniatura (TouchableOpacity envolve a Image) — usa o nome no modal aberto
    const img = screen.UNSAFE_getAllByType(require('react-native').Image)[0];
    fireEvent.press(img.parent as never);
    expect(screen.getByText('João')).toBeTruthy();
  });
});
