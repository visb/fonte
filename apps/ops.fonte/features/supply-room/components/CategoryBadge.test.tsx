import { render, screen } from '@testing-library/react-native';
import { SupplyRoomCategory } from '@fonte/types';
import { CategoryBadge } from './CategoryBadge';

describe('CategoryBadge', () => {
  it('exibe o rótulo em português da categoria', () => {
    render(<CategoryBadge category={SupplyRoomCategory.CLEANING} />);
    expect(screen.getByText('Limpeza')).toBeOnTheScreen();
  });

  it('renderiza categoria EPI', () => {
    render(<CategoryBadge category={SupplyRoomCategory.PPE} />);
    expect(screen.getByText('EPI')).toBeOnTheScreen();
  });

  it('renderiza categoria Outros', () => {
    render(<CategoryBadge category={SupplyRoomCategory.OTHER} />);
    expect(screen.getByText('Outros')).toBeOnTheScreen();
  });
});
