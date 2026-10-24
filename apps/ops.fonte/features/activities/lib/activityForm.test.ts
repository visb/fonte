import { ActivityStatus, Role } from '@fonte/types';
import { newActivitySchema, resolveCreateStatus } from './activityForm';

describe('newActivitySchema (story 224)', () => {
  const base = { title: 'Varrer', description: '', responsibleStaffId: null };

  it('TODO sem responsável → "Escolha o responsável"', () => {
    const r = newActivitySchema.safeParse({ ...base, status: ActivityStatus.TODO });
    expect(r.success).toBe(false);
    expect(r.error?.issues[0]).toMatchObject({
      path: ['responsibleStaffId'],
      message: 'Escolha o responsável',
    });
  });

  it('TODO com responsável passa', () => {
    const r = newActivitySchema.safeParse({
      ...base,
      status: ActivityStatus.TODO,
      responsibleStaffId: 's1',
    });
    expect(r.success).toBe(true);
  });

  it.each([ActivityStatus.DRAFT, ActivityStatus.REQUESTED])(
    '%s sem responsável passa',
    (status) => {
      expect(newActivitySchema.safeParse({ ...base, status }).success).toBe(true);
    },
  );

  it('DOING não é coluna de criação', () => {
    expect(
      newActivitySchema.safeParse({ ...base, status: ActivityStatus.DOING }).success,
    ).toBe(false);
  });
});

describe('resolveCreateStatus (story 224)', () => {
  const coordinator = { role: Role.COORDINATOR, houseId: 'h1' };
  const servant = { role: Role.SERVANT, houseId: 'h1' };

  it('coordenador: ?status= permitido vira o default', () => {
    expect(resolveCreateStatus('REQUESTED', coordinator)).toBe(ActivityStatus.REQUESTED);
    expect(resolveCreateStatus('TODO', coordinator)).toBe(ActivityStatus.TODO);
  });

  it('servo: ?status= fora de DRAFT cai em DRAFT', () => {
    expect(resolveCreateStatus('TODO', servant)).toBe(ActivityStatus.DRAFT);
  });

  it('valor inválido, de coluna não criável ou ausente cai em DRAFT', () => {
    expect(resolveCreateStatus('DOING', coordinator)).toBe(ActivityStatus.DRAFT);
    expect(resolveCreateStatus('xyz', coordinator)).toBe(ActivityStatus.DRAFT);
    expect(resolveCreateStatus(undefined, coordinator)).toBe(ActivityStatus.DRAFT);
    expect(resolveCreateStatus(['TODO'], coordinator)).toBe(ActivityStatus.DRAFT);
  });
});
