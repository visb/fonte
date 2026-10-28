import { CreateIncidentResidents1783038700000 } from '../../database/migrations/1783038700000-CreateIncidentResidents';

/** Story 227 — catraca da migration: junção, backfill antes do drop e down que repopula. */
describe('migration CreateIncidentResidents (story 227)', () => {
  function run(direction: 'up' | 'down') {
    const sql: string[] = [];
    const queryRunner = { query: jest.fn(async (q: string) => void sql.push(q.replace(/\s+/g, ' ').trim())) };
    const migration = new CreateIncidentResidents1783038700000();
    return migration[direction](queryRunner as never).then(() => sql);
  }

  it('up cria a junção com PK composta, FKs e índice em resident_id', async () => {
    const sql = await run('up');
    expect(sql[0]).toContain('CREATE TABLE IF NOT EXISTS public.incident_residents');
    expect(sql[0]).toContain('PRIMARY KEY (incident_id, resident_id)');
    expect(sql[0]).toContain('REFERENCES public.incidents(id) ON DELETE CASCADE');
    expect(sql[0]).toContain('REFERENCES public.residents(id) ON DELETE CASCADE');
    expect(sql[1]).toContain('ON public.incident_residents (resident_id)');
  });

  it('up preserva o filho das ocorrências antigas ANTES de derrubar a coluna', async () => {
    const sql = await run('up');
    const backfill = sql.findIndex((q) => q.startsWith('INSERT INTO public.incident_residents'));
    const drop = sql.findIndex((q) => q.includes('DROP COLUMN IF EXISTS resident_id'));
    expect(backfill).toBeGreaterThan(-1);
    expect(sql[backfill]).toContain('WHERE resident_id IS NOT NULL');
    expect(drop).toBeGreaterThan(backfill);
  });

  it('down recria a coluna, repopula com o primeiro filho e remove a junção', async () => {
    const sql = await run('down');
    expect(sql[0]).toBe('ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS resident_id uuid NULL');
    expect(sql[1]).toContain('DISTINCT ON (incident_id)');
    expect(sql[2]).toContain('ON DELETE SET NULL');
    expect(sql[sql.length - 1]).toBe('DROP TABLE IF EXISTS public.incident_residents');
  });

  it('timestamp maior que a última migration (story 225)', () => {
    expect(new CreateIncidentResidents1783038700000().name).toBe('CreateIncidentResidents1783038700000');
    expect(1783038700000).toBeGreaterThan(1783038600000);
  });
});
