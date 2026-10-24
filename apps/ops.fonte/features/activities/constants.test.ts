import { ActivityStatus, Role } from '@fonte/types';
import { CREATE_COPY, CREATE_STATUS_LABELS, canQuickAddInStatus } from './constants';

describe('activities/constants — canQuickAddInStatus (story 224)', () => {
  const servant = { role: Role.SERVANT, houseId: 'h1' };
  const coordinator = { role: Role.COORDINATOR, houseId: 'h1' };
  const adminInHouse = { role: Role.ADMIN, houseId: 'h1' };

  it('DRAFT para todos', () => {
    expect(canQuickAddInStatus(ActivityStatus.DRAFT, servant)).toBe(true);
    expect(canQuickAddInStatus(ActivityStatus.DRAFT, coordinator)).toBe(true);
    expect(canQuickAddInStatus(ActivityStatus.DRAFT, { role: null, houseId: null })).toBe(true);
  });

  it.each([ActivityStatus.REQUESTED, ActivityStatus.TODO])(
    '%s só para o coordenador da casa',
    (status) => {
      expect(canQuickAddInStatus(status, coordinator)).toBe(true);
      expect(canQuickAddInStatus(status, adminInHouse)).toBe(true);
      expect(canQuickAddInStatus(status, servant)).toBe(false);
      expect(canQuickAddInStatus(status, { role: Role.COORDINATOR, houseId: null })).toBe(false);
    },
  );

  it.each([ActivityStatus.DOING, ActivityStatus.BLOCKED, ActivityStatus.DONE])(
    '%s nunca',
    (status) => {
      expect(canQuickAddInStatus(status, coordinator)).toBe(false);
      expect(canQuickAddInStatus(status, adminInHouse)).toBe(false);
    },
  );
});

describe('activities/constants — textos da criação (story 224)', () => {
  it('rótulo e botão por status criável', () => {
    expect(CREATE_STATUS_LABELS[ActivityStatus.REQUESTED]).toBe('Solicitação');
    expect(CREATE_COPY[ActivityStatus.DRAFT]?.button).toBe('Criar rascunho');
    expect(CREATE_COPY[ActivityStatus.REQUESTED]?.button).toBe('Criar solicitação');
    expect(CREATE_COPY[ActivityStatus.TODO]?.button).toBe('Criar atividade');
    expect(CREATE_COPY[ActivityStatus.DOING]).toBeUndefined();
  });
});
