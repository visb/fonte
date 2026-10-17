import { fireEvent, render, screen } from '@testing-library/react-native';
import { ScrollView } from 'react-native';
import { ActivityStatus } from '@fonte/types';
import { ACTIVITY_COLUMNS } from '@/features/activities/constants';
import { ActivityStatusTabs } from './ActivityStatusTabs';

const COUNTS: Record<ActivityStatus, number> = {
  [ActivityStatus.DRAFT]: 0,
  [ActivityStatus.REQUESTED]: 2,
  [ActivityStatus.TODO]: 3,
  [ActivityStatus.DOING]: 1,
  [ActivityStatus.BLOCKED]: 0,
  [ActivityStatus.DONE]: 7,
} as Record<ActivityStatus, number>;

const TABS = ACTIVITY_COLUMNS.map((c) => ({ ...c, count: COUNTS[c.status] }));

describe('ActivityStatusTabs (story 208)', () => {
  it('renderiza as 6 abas com o contador certo, inclusive 0', () => {
    render(<ActivityStatusTabs tabs={TABS} active={ActivityStatus.DRAFT} onSelect={jest.fn()} />);

    expect(screen.getAllByRole('tab')).toHaveLength(6);
    for (const tab of TABS) {
      expect(screen.getByText(tab.title)).toBeTruthy();
      expect(screen.getByTestId(`activity-tab-count-${tab.status}`).props.children).toBe(
        tab.count,
      );
    }
    expect(screen.getByLabelText('Rascunhos 0')).toBeTruthy();
  });

  it('tocar numa aba chama onSelect com o status', () => {
    const onSelect = jest.fn();
    render(<ActivityStatusTabs tabs={TABS} active={ActivityStatus.DRAFT} onSelect={onSelect} />);

    fireEvent.press(screen.getByText('A fazer'));

    expect(onSelect).toHaveBeenCalledWith(ActivityStatus.TODO);
  });

  it('a aba ativa fica destacada', () => {
    render(<ActivityStatusTabs tabs={TABS} active={ActivityStatus.TODO} onSelect={jest.fn()} />);

    expect(screen.getByTestId(`activity-tab-${ActivityStatus.TODO}`)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: true }),
    );
    expect(screen.getByTestId(`activity-tab-${ActivityStatus.DRAFT}`)).toHaveProp(
      'accessibilityState',
      expect.objectContaining({ selected: false }),
    );
  });

  it('a faixa rola até o chip ativo quando a aba muda', () => {
    const scrollTo = jest.spyOn(ScrollView.prototype, 'scrollTo').mockImplementation(() => {});
    const { rerender } = render(
      <ActivityStatusTabs tabs={TABS} active={ActivityStatus.DRAFT} onSelect={jest.fn()} />,
    );
    fireEvent(screen.getByTestId(`activity-tab-${ActivityStatus.DONE}`), 'layout', {
      nativeEvent: { layout: { x: 400, y: 0, width: 90, height: 30 } },
    });

    rerender(<ActivityStatusTabs tabs={TABS} active={ActivityStatus.DONE} onSelect={jest.fn()} />);
    expect(scrollTo).toHaveBeenCalledWith({ x: 384, animated: true });

    // Chip ainda sem layout medido: não rola.
    scrollTo.mockClear();
    rerender(<ActivityStatusTabs tabs={TABS} active={ActivityStatus.DOING} onSelect={jest.fn()} />);
    expect(scrollTo).not.toHaveBeenCalled();
    scrollTo.mockRestore();
  });
});
