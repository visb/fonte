import { AddStaffDismissal1783038300000 } from '../../database/migrations/1783038300000-AddStaffDismissal';

/** Story 217 — catraca da migration: colunas de desligamento e enum do motivo. */
describe('migration AddStaffDismissal (story 217)', () => {
  function run(direction: 'up' | 'down') {
    const sql: string[] = [];
    const queryRunner = { query: jest.fn(async (q: string) => void sql.push(q.replace(/\s+/g, ' ').trim())) };
    const migration = new AddStaffDismissal1783038300000();
    return migration[direction](queryRunner as never).then(() => sql);
  }

  it('up cria dismissed_at, o enum do motivo e end_reason/end_notes', async () => {
    const sql = await run('up');
    expect(sql[0]).toBe('ALTER TABLE public.staff ADD COLUMN IF NOT EXISTS dismissed_at date NULL');
    const type = sql.find((q) => q.includes('CREATE TYPE'))!;
    expect(type).toContain(
      "'OWN_REQUEST', 'COORDINATION_DECISION', 'TRANSFER_OTHER_WORK', 'DEATH', 'OTHER'",
    );
    expect(type).toContain('duplicate_object');
    const alter = sql.find((q) => q.startsWith('ALTER TABLE public.staff_service_periods'))!;
    expect(alter).toContain('end_reason public.staff_service_periods_end_reason_enum NULL');
    expect(alter).toContain('end_notes text NULL');
  });

  it('down desfaz na ordem inversa', async () => {
    expect(await run('down')).toEqual([
      'ALTER TABLE public.staff_service_periods DROP COLUMN IF EXISTS end_notes',
      'ALTER TABLE public.staff_service_periods DROP COLUMN IF EXISTS end_reason',
      'DROP TYPE IF EXISTS public.staff_service_periods_end_reason_enum',
      'ALTER TABLE public.staff DROP COLUMN IF EXISTS dismissed_at',
    ]);
  });

  it('timestamp maior que a última migration (story 216)', () => {
    expect(new AddStaffDismissal1783038300000().name).toBe('AddStaffDismissal1783038300000');
    expect(1783038300000).toBeGreaterThan(1783038200000);
  });
});
