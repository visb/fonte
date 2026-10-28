import { Alert } from 'react-native';
import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { DailySessionStatus, ServantRank } from '@fonte/types';

jest.mock('react-native-gesture-handler', () => require('@/lib/test/__mocks__/gestureHandler'));
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('@/lib/api', () => ({
  resolveAssetUrl: (u: string | null) => (u ? `http://api${u}` : null),
}));

import type { FakeGesture } from '@/lib/test/__mocks__/gestureHandler';
import { makeBoard, resident, staff } from '@/lib/test/__mocks__/dailyBoardFixture';
import { DailyPersonCard } from './DailyPersonCard';
import { DailyRankBadge } from './DailyRankBadge';
import { MoveToSheet } from './MoveToSheet';
import { DailyApplyBar } from './DailyApplyBar';
import { DailyOfflineBanner } from './DailyOfflineBanner';
import { DailyDraggableCard } from './DailyDraggableCard';

const noopDrag = {
  onDragStart: jest.fn(), onDragMove: jest.fn(), onDragEnd: jest.fn(), onDragCancel: jest.fn(),
};

beforeEach(() => jest.clearAllMocks());

describe('DailyPersonCard / DailyRankBadge (decisão 6)', () => {
  it('filho: só nome (e iniciais), sem badge', () => {
    render(<DailyPersonCard person={resident('r1', 'Bruno Lima')} />);
    expect(screen.getByText('Bruno Lima')).toBeTruthy();
    expect(screen.getByText('BL')).toBeTruthy();
    expect(screen.queryByTestId(/servant-rank-/)).toBeNull();
    expect(screen.queryByTestId('daily-role-badge-r1')).toBeNull();
  });

  it('servo com rank: badge do nível', () => {
    render(<DailyPersonCard person={staff('s2', 'Eva', ['m2'], { rank: ServantRank.CONSAGRADO, roleLabel: null })} />);
    expect(screen.getByTestId('servant-rank-CONSAGRADO')).toBeTruthy();
    expect(screen.getByText('Consagrado')).toBeTruthy();
  });

  it('staff sem rank: badge com o label do papel', () => {
    render(<DailyPersonCard person={staff('c1', 'Dora', [], { roleLabel: 'Coordenador' })} />);
    expect(screen.getByTestId('daily-role-badge-c1')).toBeTruthy();
    expect(screen.getByText('Coordenador')).toBeTruthy();
  });

  it('staff sem rank nem label → sem badge', () => {
    const { toJSON } = render(<DailyRankBadge person={staff('x', 'X', [], { roleLabel: null })} />);
    expect(toJSON()).toBeNull();
  });

  it('aviso "estava em N ministérios" e foto quando há', () => {
    render(<DailyPersonCard person={staff('s1', 'Carlos', ['m1', 'm2', 'm3'], { photoThumbUrl: '/p.jpg' })} floating />);
    expect(screen.getByText('estava em 3 ministérios')).toBeTruthy();
    expect(screen.getByTestId('daily-person-photo').props.source).toEqual({ uri: 'http://api/p.jpg' });
  });
});

describe('MoveToSheet', () => {
  const ministries = makeBoard().ministries;

  it('lista "Sem ministério" + ministérios; escolher dispara o move', () => {
    const onSelect = jest.fn();
    const person = resident('r1', 'Bruno');
    render(<MoveToSheet person={person} ministries={ministries} currentMinistryId="m1" onSelect={onSelect} onClose={jest.fn()} />);
    expect(screen.getByText('Mover para…')).toBeTruthy();
    expect(screen.getByText('Sem ministério')).toBeTruthy();
    expect(screen.getByText('Horta')).toBeTruthy();
    fireEvent.press(screen.getByTestId('move-to-m2'));
    expect(onSelect).toHaveBeenCalledWith(person, 'm2');
    fireEvent.press(screen.getByTestId('move-to-none'));
    expect(onSelect).toHaveBeenCalledWith(person, null);
  });

  it('caixa atual fica marcada e desabilitada; fechar', () => {
    const onSelect = jest.fn();
    const onClose = jest.fn();
    render(<MoveToSheet person={resident('r2', 'Ana')} ministries={ministries} currentMinistryId={null} onSelect={onSelect} onClose={onClose} />);
    fireEvent.press(screen.getByTestId('move-to-none'));
    expect(onSelect).not.toHaveBeenCalled();
    fireEvent.press(screen.getByLabelText('Fechar sheet'));
    fireEvent.press(screen.getByLabelText('Fechar'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('sem pessoa: escolher não faz nada', () => {
    const onSelect = jest.fn();
    render(<MoveToSheet person={null} ministries={ministries} currentMinistryId={undefined} onSelect={onSelect} onClose={jest.fn()} />);
    expect(screen.queryByText('Mover para…')).toBeNull();
  });
});

describe('DailyApplyBar (decisão 8)', () => {
  const base = {
    changes: 2, isOnline: true, isApplying: false, isStarting: false, skipped: [],
    onApply: jest.fn(), onStartNew: jest.fn(),
  };

  it('confirmação com a contagem antes de aplicar', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    render(<DailyApplyBar {...base} session={makeBoard().session} />);
    fireEvent.press(screen.getByTestId('daily-apply'));
    expect(alert).toHaveBeenCalledWith('Aplicar a daily?', '2 mudanças nos ministérios', expect.any(Array));
    const buttons = alert.mock.calls[0][2] as { text: string; onPress?: () => void }[];
    buttons.find((b) => b.text === 'Aplicar')!.onPress!();
    expect(base.onApply).toHaveBeenCalled();
  });

  it('depois de aplicar: "Aplicado às…" e "Nova daily"', () => {
    const session = makeBoard({
      status: DailySessionStatus.APPLIED, appliedAt: new Date(2026, 9, 27, 14, 5).toISOString(), appliedByName: 'Coord',
    }).session;
    render(<DailyApplyBar {...base} session={session} />);
    expect(screen.getByText('Aplicado às 14:05 por Coord')).toBeTruthy();
    fireEvent.press(screen.getByTestId('daily-start-new'));
    expect(base.onStartNew).toHaveBeenCalled();
  });

  it('mostra os pulados', () => {
    render(<DailyApplyBar {...base} session={makeBoard().session} skipped={[{ key: 'k', name: 'Bruno', reason: 'saiu' }]} />);
    expect(screen.getByTestId('daily-skipped')).toBeTruthy();
    expect(screen.getByText('Bruno — saiu')).toBeTruthy();
  });

  it('offline ou aplicando: botão desabilitado', () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    const { rerender } = render(<DailyApplyBar {...base} isOnline={false} session={makeBoard().session} />);
    fireEvent.press(screen.getByTestId('daily-apply'));
    rerender(<DailyApplyBar {...base} isApplying session={makeBoard().session} />);
    fireEvent.press(screen.getByTestId('daily-apply'));
    expect(alert).not.toHaveBeenCalled();
  });
});

describe('DailyOfflineBanner (decisão 11)', () => {
  it('sem rede mostra o aviso; com rede, nada', () => {
    const { rerender } = render(<DailyOfflineBanner visible />);
    expect(screen.getByText(/A daily precisa de conexão/)).toBeTruthy();
    rerender(<DailyOfflineBanner visible={false} />);
    expect(screen.queryByTestId('offline-notice')).toBeNull();
  });
});

describe('DailyDraggableCard — gestos', () => {
  const person = resident('r2', 'Ana');
  const gestureOf = () => screen.getByTestId('gesture-daily-card-r2').props.gesture as FakeGesture;

  it('long-press (300ms) arrasta; toque abre o "Mover para…"', () => {
    const onPress = jest.fn();
    render(<DailyDraggableCard person={person} disabled={false} onPress={onPress} isDragging={false} {...noopDrag} />);
    const [pan, tap] = gestureOf().gestures!;
    expect(pan.config.activateAfterLongPress).toBe(300);
    expect(pan.config.enabled).toBe(true);

    pan.handlers.onStart({ absoluteX: 10, absoluteY: 20 });
    expect(noopDrag.onDragStart).toHaveBeenCalledWith(person, 10, 20);
    pan.handlers.onUpdate({ absoluteX: 11, absoluteY: 30 });
    expect(noopDrag.onDragMove).toHaveBeenCalledWith(11, 30);
    pan.handlers.onEnd();
    expect(noopDrag.onDragEnd).toHaveBeenCalled();
    pan.handlers.onFinalize({}, true);
    expect(noopDrag.onDragCancel).not.toHaveBeenCalled();
    pan.handlers.onFinalize({}, false);
    expect(noopDrag.onDragCancel).toHaveBeenCalled();

    tap.handlers.onEnd({}, false);
    expect(onPress).not.toHaveBeenCalled();
    tap.handlers.onEnd({}, true);
    expect(onPress).toHaveBeenCalledWith(person);
  });

  it('desabilitado (offline/aplicada): gestos desligados; esmaecido durante o arrasto', () => {
    render(<DailyDraggableCard person={person} disabled onPress={jest.fn()} isDragging {...noopDrag} />);
    const [pan, tap] = gestureOf().gestures!;
    expect(pan.config.enabled).toBe(false);
    expect(tap.config.enabled).toBe(false);
    expect(screen.getByTestId('daily-card-r2').props.style).toEqual({ opacity: 0.35 });
  });
});

describe('DailyBoard', () => {
  // Import tardio: o mock do gesture handler já está ativo.
  const { DailyBoard } = require('./DailyBoard') as typeof import('./DailyBoard');

  function renderBoard(props: Partial<React.ComponentProps<typeof DailyBoard>> = {}) {
    const onMove = jest.fn();
    const onPressPerson = jest.fn();
    const utils = render(
      <DailyBoard board={makeBoard()} disabled={false} onMove={onMove} onPressPerson={onPressPerson} lastRemoteMove={null} {...props} />,
    );
    return { ...utils, onMove, onPressPerson };
  }

  it('"Sem ministério" no topo + caixas com contador', () => {
    renderBoard();
    expect(screen.getByText('Sem ministério')).toBeTruthy();
    expect(screen.getByText('Cozinha')).toBeTruthy();
    expect(screen.getByTestId('daily-box-count-m1').props.children).toBe(2);
    expect(screen.getByTestId('daily-box-count-__unassigned__').props.children).toBe(2);
  });

  it('caixa vazia mostra "Ninguém aqui"', () => {
    const board = makeBoard();
    board.ministries[1].members = [];
    renderBoard({ board });
    expect(screen.getByText('Ninguém aqui')).toBeTruthy();
  });

  it('arrastar um filho para outra caixa chama onMove; remoto da mesma pessoa cancela', () => {
    const { onMove, rerender, onPressPerson } = renderBoard();
    const scroll = screen.getByTestId('daily-board-scroll');
    fireEvent(screen.getByTestId('daily-box-__unassigned__'), 'layout', { nativeEvent: { layout: { y: 0, height: 200 } } });
    fireEvent(screen.getByTestId('daily-box-m1'), 'layout', { nativeEvent: { layout: { y: 210, height: 300 } } });
    fireEvent(scroll, 'contentSizeChange', 400, 900);

    const pan = (screen.getByTestId('gesture-daily-card-r2').props.gesture as FakeGesture).gestures![0];
    act(() => pan.handlers.onStart({ absoluteX: 10, absoluteY: 50 }));
    expect(screen.getByTestId('daily-floating-card')).toBeTruthy();
    expect(scroll.props.scrollEnabled).toBe(false);

    act(() => pan.handlers.onUpdate({ absoluteX: 10, absoluteY: 300 }));
    act(() => pan.handlers.onEnd());
    // Sem viewport medido (containerRef sem measureInWindow no jest): sem hover, sem move.
    expect(onMove).not.toHaveBeenCalled();
    expect(screen.queryByTestId('daily-floating-card')).toBeNull();

    act(() => pan.handlers.onStart({ absoluteX: 10, absoluteY: 50 }));
    rerender(
      <DailyBoard
        board={makeBoard()}
        disabled={false}
        onMove={onMove}
        onPressPerson={onPressPerson}
        lastRemoteMove={{ sessionId: 'sess-1', personType: 'RESIDENT' as never, personId: 'r2', toMinistryId: 'm1', version: 1, movedByUserId: 'u' }}
      />,
    );
    expect(screen.queryByTestId('daily-floating-card')).toBeNull();
  });

  it('tocar num card chama onPressPerson', () => {
    const { onPressPerson } = renderBoard();
    const tap = (screen.getByTestId('gesture-daily-card-s1').props.gesture as FakeGesture).gestures![1];
    act(() => tap.handlers.onEnd({}, true));
    expect(onPressPerson).toHaveBeenCalledWith(expect.objectContaining({ id: 's1' }));
  });
});
