import { render, screen } from '@testing-library/react-native';
import { ServantRank } from '@fonte/types';
import { ServantRankBadge } from './ServantRankBadge';
import { SERVANT_RANK_BADGE } from '@/features/staff/constants';

describe('ServantRankBadge (story 207)', () => {
  it.each([
    [ServantRank.ASPIRANTE, 'Aspirante'],
    [ServantRank.CONSAGRADO, 'Consagrado'],
    [ServantRank.ALIANCADO, 'Aliançado'],
  ])('%s → rótulo "%s" com a cor do nível', (rank, label) => {
    render(<ServantRankBadge rank={rank} />);
    const badge = screen.getByTestId(`servant-rank-${rank}`);
    expect(badge.props.style).toEqual({ backgroundColor: SERVANT_RANK_BADGE[rank].bg });
    const text = screen.getByText(label);
    expect(text.props.style).toEqual({ color: SERVANT_RANK_BADGE[rank].color });
  });

  it('cores seguem o adm: aspirante cinza, consagrado azul, aliançado verde', () => {
    expect(SERVANT_RANK_BADGE[ServantRank.ASPIRANTE].color).toBe('#4b5563');
    expect(SERVANT_RANK_BADGE[ServantRank.CONSAGRADO].color).toBe('#1d4ed8');
    expect(SERVANT_RANK_BADGE[ServantRank.ALIANCADO].color).toBe('#15803d');
  });

  it('rank nulo ou ausente → nada renderizado', () => {
    const { toJSON } = render(<ServantRankBadge rank={null} />);
    expect(toJSON()).toBeNull();
    const undef = render(<ServantRankBadge rank={undefined} />);
    expect(undef.toJSON()).toBeNull();
  });

  it('valor desconhecido (cache antigo/backend novo) → nada renderizado', () => {
    const { toJSON } = render(<ServantRankBadge rank={'MESTRE' as ServantRank} />);
    expect(toJSON()).toBeNull();
  });
});
