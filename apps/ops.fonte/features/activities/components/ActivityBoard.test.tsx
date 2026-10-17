import { fireEvent, render, screen } from '@testing-library/react-native';
import { FlatList, Text } from 'react-native';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { groupActivitiesByStatus } from '@/features/activities/lib/columns';
import { ActivityBoard } from './ActivityBoard';

const COLUMNS = groupActivitiesByStatus([
  { id: 'a1', title: 'A', status: ActivityStatus.TODO } as Activity,
]);

function setup(active: ActivityStatus = ActivityStatus.TODO) {
  const onSelect = jest.fn();
  const scrollToOffset = jest
    .spyOn(FlatList.prototype, 'scrollToOffset')
    .mockImplementation(() => {});
  const utils = render(
    <ActivityBoard
      columns={COLUMNS}
      active={active}
      onSelect={onSelect}
      renderColumn={(column, width) => <Text>{`coluna:${column.status}:${width}`}</Text>}
    />,
  );
  return { ...utils, onSelect, scrollToOffset };
}

function pager() {
  return screen.getByTestId('activity-board-pager');
}

/** Rolagem horizontal do pager (o VirtualizedList exige medidas no evento). */
function scrollPagerTo(x: number) {
  fireEvent.scroll(pager(), {
    nativeEvent: {
      contentOffset: { x, y: 0 },
      layoutMeasurement: { width: 400, height: 600 },
      contentSize: { width: 2400, height: 600 },
    },
  });
}

afterEach(() => jest.restoreAllMocks());

describe('ActivityBoard (story 208)', () => {
  it('renderiza as abas com contador e uma página por coluna', () => {
    setup();
    expect(screen.getAllByRole('tab')).toHaveLength(6);
    expect(screen.getByLabelText('A fazer 1')).toBeTruthy();
    expect(pager()).toHaveProp('initialScrollIndex', 2);
    expect(pager()).toHaveProp('pagingEnabled', true);
  });

  it('tocar no chip seleciona a aba e leva o pager à coluna', () => {
    const { onSelect, scrollToOffset } = setup();
    fireEvent(screen.getByTestId('activity-board-pages'), 'layout', {
      nativeEvent: { layout: { width: 400, height: 600, x: 0, y: 0 } },
    });
    scrollToOffset.mockClear();

    fireEvent.press(screen.getByText('Concluídas'));

    expect(onSelect).toHaveBeenCalledWith(ActivityStatus.DONE);
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 2000, animated: false });
  });

  it('ao medir o espaço posiciona o pager na coluna ativa', () => {
    const { scrollToOffset } = setup(ActivityStatus.DOING);
    fireEvent(screen.getByTestId('activity-board-pages'), 'layout', {
      nativeEvent: { layout: { width: 300, height: 600, x: 0, y: 0 } },
    });
    expect(scrollToOffset).toHaveBeenCalledWith({ offset: 900, animated: false });
    expect(screen.getByText('coluna:DOING:300')).toBeTruthy();
  });

  it('deslizar até assentar numa página troca a aba', () => {
    const { onSelect } = setup();
    fireEvent(screen.getByTestId('activity-board-pages'), 'layout', {
      nativeEvent: { layout: { width: 400, height: 600, x: 0, y: 0 } },
    });

    // No meio do caminho entre páginas: ignora.
    scrollPagerTo(1000);
    expect(onSelect).not.toHaveBeenCalled();

    // Assentou na própria coluna ativa: nada muda.
    scrollPagerTo(800);
    expect(onSelect).not.toHaveBeenCalled();

    scrollPagerTo(1200);
    expect(onSelect).toHaveBeenCalledWith(ActivityStatus.DOING);

    // Além da última página (bounce): ignora.
    onSelect.mockClear();
    scrollPagerTo(2400);
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('getItemLayout usa a largura da página', () => {
    setup();
    const getItemLayout = pager().props.getItemLayout;
    expect(getItemLayout(COLUMNS, 3)).toEqual(
      expect.objectContaining({ offset: expect.any(Number), index: 3 }),
    );
  });
});
