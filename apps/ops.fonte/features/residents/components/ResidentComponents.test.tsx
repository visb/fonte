import { fireEvent, render, screen } from '@testing-library/react-native';
import { FollowUpType, ResidentStatus, Role } from '@fonte/types';

// @expo/vector-icons depende de fontes nativas: stub leve.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

// expo-router: captura navegação.
const mockPush = jest.fn();
jest.mock('expo-router', () => ({ router: { push: (...a: unknown[]) => mockPush(...a) } }));

// Story 196: o `⋮` da linha depende da role do staff logado.
const mockAuth = jest.fn<{ staff: { user: { role: Role } } }, []>(() => ({
  staff: { user: { role: Role.COORDINATOR } },
}));
jest.mock('@/lib/auth', () => ({ useAuth: () => mockAuth() }));

import { ResidentListItem } from './ResidentListItem';
import { ResidentSearchBar } from './ResidentSearchBar';
import { ResidentStatusFilterModal } from './ResidentStatusFilterModal';
import { TrackingEventItem } from './TrackingEventItem';
import { ResidentPhoto } from './ResidentPhoto';
import { ResidentPhotoViewer } from './ResidentPhotoViewer';

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

  // Story 196 — o gate que impede o lançamento fadado ao 403 na fila offline.
  describe('menu de linha (⋮)', () => {
    const menuLabel = 'Ações de João Silva';

    it('aparece para COORDINATOR com filho ACTIVE', () => {
      mockAuth.mockReturnValue({ staff: { user: { role: Role.COORDINATOR } } });
      render(<ResidentListItem item={item} onOpenMenu={jest.fn()} />);
      expect(screen.getByLabelText(menuLabel)).toBeTruthy();
    });

    it('aparece para ADMIN', () => {
      mockAuth.mockReturnValue({ staff: { user: { role: Role.ADMIN } } });
      render(<ResidentListItem item={item} onOpenMenu={jest.fn()} />);
      expect(screen.getByLabelText(menuLabel)).toBeTruthy();
    });

    // `PATCH /residents/:id` é ADMIN/COORDINATOR: o servo não pode. Se o botão
    // existisse, o toque viraria item de fila morto em /sync com erro 403.
    it('NÃO aparece para SERVANT', () => {
      mockAuth.mockReturnValue({ staff: { user: { role: Role.SERVANT } } });
      render(<ResidentListItem item={item} onOpenMenu={jest.fn()} />);
      expect(screen.queryByLabelText(menuLabel)).toBeNull();
    });

    it.each([ResidentStatus.DISCHARGED, ResidentStatus.EVADED, ResidentStatus.ARCHIVED])(
      'NÃO aparece para filho %s (quem já saiu não sai de novo)',
      (status) => {
        mockAuth.mockReturnValue({ staff: { user: { role: Role.COORDINATOR } } });
        render(<ResidentListItem item={{ ...item, status }} onOpenMenu={jest.fn()} />);
        expect(screen.queryByLabelText(menuLabel)).toBeNull();
      },
    );

    it.each([ResidentStatus.DISCIPLINE, ResidentStatus.TEMP_LEAVE])(
      'aparece para filho %s',
      (status) => {
        mockAuth.mockReturnValue({ staff: { user: { role: Role.COORDINATOR } } });
        render(<ResidentListItem item={{ ...item, status }} onOpenMenu={jest.fn()} />);
        expect(screen.getByLabelText(menuLabel)).toBeTruthy();
      },
    );

    it('sem handler de menu não renderiza o ⋮', () => {
      mockAuth.mockReturnValue({ staff: { user: { role: Role.COORDINATOR } } });
      render(<ResidentListItem item={item} />);
      expect(screen.queryByLabelText(menuLabel)).toBeNull();
    });

    it('tocar no ⋮ abre o menu e NÃO navega para a ficha', () => {
      mockAuth.mockReturnValue({ staff: { user: { role: Role.COORDINATOR } } });
      const onOpenMenu = jest.fn();
      render(<ResidentListItem item={item} onOpenMenu={onOpenMenu} />);
      fireEvent.press(screen.getByLabelText(menuLabel));
      expect(onOpenMenu).toHaveBeenCalledWith(item);
      expect(mockPush).not.toHaveBeenCalled();
    });
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

  it('fecha o modal pelo botão de fechar', () => {
    render(<ResidentPhoto name="Maria" photoUrl="https://x/full.jpg" />);
    const img = screen.UNSAFE_getAllByType(require('react-native').Image)[0];
    fireEvent.press(img.parent as never);
    expect(screen.getByText('Maria')).toBeTruthy();
    // botão X (Ionicons close) fecha o modal
    fireEvent.press(screen.getByText('icon:close'));
    expect(screen.queryByText('Maria')).toBeNull();
  });

  it('usa só a thumb quando não há URL cheia (fallback)', () => {
    render(<ResidentPhoto name="Ana" photoThumbUrl="https://x/t.jpg" />);
    // thumb existe → mostra Image; fullUrl resolve para a thumb (toca e abre)
    const img = screen.UNSAFE_getAllByType(require('react-native').Image)[0];
    fireEvent.press(img.parent as never);
    expect(screen.getByText('Ana')).toBeTruthy();
  });
});

// Story 179: expansor extraído do ResidentPhoto para a contagem reusar a partir
// de uma thumb de 40px.
describe('ResidentPhotoViewer', () => {
  const baseProps = {
    name: 'João',
    photoUrl: 'https://x/full.jpg',
    photoThumbUrl: 'https://x/t.jpg',
    onClose: jest.fn(),
  };

  function images() {
    return screen.UNSAFE_getAllByType(require('react-native').Image);
  }

  it('fechado não renderiza a imagem', () => {
    render(<ResidentPhotoViewer {...baseProps} visible={false} />);
    expect(screen.queryByText('João')).toBeNull();
  });

  it('aberto mostra a versão cheia e o nome', () => {
    render(<ResidentPhotoViewer {...baseProps} visible />);
    expect(screen.getByText('João')).toBeTruthy();
    expect(images()[0].props.source.uri).toBe('https://x/full.jpg');
  });

  it('falha ao carregar a versão cheia cai na thumb', () => {
    render(<ResidentPhotoViewer {...baseProps} visible />);
    // A cheia pode nunca ter sido baixada no aparelho; a thumb já está no cache
    // de imagem do SO porque a lista a renderizou.
    fireEvent(images()[0], 'error');
    expect(images()[0].props.source.uri).toBe('https://x/t.jpg');
  });

  it('só com thumb renderiza a thumb', () => {
    render(<ResidentPhotoViewer {...baseProps} visible photoUrl={null} />);
    expect(images()[0].props.source.uri).toBe('https://x/t.jpg');
  });

  it('sem nenhuma URL não renderiza o modal', () => {
    render(<ResidentPhotoViewer {...baseProps} visible photoUrl={null} photoThumbUrl={null} />);
    expect(screen.queryByText('João')).toBeNull();
  });

  it('fecha pelo botão e pelo toque no fundo', () => {
    const onClose = jest.fn();
    render(<ResidentPhotoViewer {...baseProps} visible onClose={onClose} />);
    fireEvent.press(screen.getByLabelText('Fechar foto'));
    expect(onClose).toHaveBeenCalledTimes(1);
    fireEvent.press(screen.getByText('João'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });
});
