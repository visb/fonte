import { ActivityStatus } from '@fonte/types';
import { canQuickAddInStatus } from './constants';

describe('activities/constants — canQuickAddInStatus', () => {
  it('permite quick-add apenas em DRAFT', () => {
    expect(canQuickAddInStatus(ActivityStatus.DRAFT, 'SERVANT')).toBe(true);
  });

  it('bloqueia quick-add em colunas não-rascunho', () => {
    expect(canQuickAddInStatus(ActivityStatus.TODO, 'ADMIN')).toBe(false);
    expect(canQuickAddInStatus(ActivityStatus.DOING, null)).toBe(false);
    expect(canQuickAddInStatus(ActivityStatus.DONE, undefined)).toBe(false);
  });
});
