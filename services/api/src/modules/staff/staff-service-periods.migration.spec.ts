import { CreateStaffServicePeriods1783038200000 } from '../../database/migrations/1783038200000-CreateStaffServicePeriods';
import { ExtendAuditLogs1783038100000 } from '../../database/migrations/1783038100000-ExtendAuditLogs';

/** Story 216 — catraca da migration: tabela, índice parcial e backfill. */
describe('migration CreateStaffServicePeriods (story 216)', () => {
  function run(direction: 'up' | 'down') {
    const sql: string[] = [];
    const queryRunner = { query: jest.fn(async (q: string) => void sql.push(q.replace(/\s+/g, ' ').trim())) };
    const migration = new CreateStaffServicePeriods1783038200000();
    return migration[direction](queryRunner as never).then(() => sql);
  }

  it('up cria a tabela com FKs, o índice único parcial de período aberto e o backfill', async () => {
    const sql = await run('up');
    const create = sql.find((q) => q.startsWith('CREATE TABLE'))!;
    expect(create).toContain('start_date date NOT NULL');
    expect(create).toContain('end_date date NULL');
    expect(create).toContain('house_id uuid NULL');
    expect(create).toContain('REFERENCES public.staff(id) ON DELETE CASCADE');
    expect(create).toContain('REFERENCES public.houses(id) ON DELETE SET NULL');

    const unique = sql.find((q) => q.includes('UX_staff_service_periods_open'))!;
    expect(unique).toContain('CREATE UNIQUE INDEX');
    expect(unique).toContain('WHERE end_date IS NULL AND deleted_at IS NULL');

    const backfill = sql.find((q) => q.startsWith('INSERT INTO public.staff_service_periods'))!;
    expect(backfill).toContain('COALESCE(s.promoted_at, s.created_at::date)');
    expect(backfill).toContain('WHERE s.deleted_at IS NULL');
  });

  it('down remove índices e tabela', async () => {
    const sql = await run('down');
    expect(sql).toEqual([
      'DROP INDEX IF EXISTS public."UX_staff_service_periods_open"',
      'DROP INDEX IF EXISTS public."IDX_staff_service_periods_staff"',
      'DROP TABLE IF EXISTS public.staff_service_periods',
    ]);
  });

  it('timestamp maior que a última migration existente', () => {
    expect(new CreateStaffServicePeriods1783038200000().name).toBe('CreateStaffServicePeriods1783038200000');
    expect(new ExtendAuditLogs1783038100000().name).toBe('ExtendAuditLogs1783038100000');
    expect(1783038200000).toBeGreaterThan(1783038100000);
  });
});
