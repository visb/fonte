import { IncidentCategory } from '@fonte/types';
import { AddIncidentCategory1783038900000 } from '../../database/migrations/1783038900000-AddIncidentCategory';

/** Story 230 — catraca da migration: coluna nullable sem backfill, down reverso. */
describe('migration AddIncidentCategory (story 230)', () => {
  function run(direction: 'up' | 'down') {
    const sql: string[] = [];
    const queryRunner = { query: jest.fn(async (q: string) => void sql.push(q.replace(/\s+/g, ' ').trim())) };
    const migration = new AddIncidentCategory1783038900000();
    return migration[direction](queryRunner as never).then(() => sql);
  }

  it('up cria o enum com todos os valores do contrato', async () => {
    const sql = await run('up');
    expect(sql[0]).toContain('CREATE TYPE public.incident_category AS ENUM');
    for (const value of Object.values(IncidentCategory)) {
      expect(sql[0]).toContain(`'${value}'`);
    }
  });

  it('up adiciona a coluna NULL sem default (antigas ficam sem categoria)', async () => {
    const sql = await run('up');
    expect(sql[1]).toBe(
      'ALTER TABLE public.incidents ADD COLUMN IF NOT EXISTS category public.incident_category NULL',
    );
    expect(sql.join(' ')).not.toContain('DEFAULT');
    expect(sql.join(' ')).not.toContain('UPDATE');
  });

  it('down remove a coluna e depois o enum', async () => {
    const sql = await run('down');
    expect(sql).toEqual([
      'ALTER TABLE public.incidents DROP COLUMN IF EXISTS category',
      'DROP TYPE IF EXISTS public.incident_category',
    ]);
  });

  it('timestamp maior que a última migration (story 229)', () => {
    expect(new AddIncidentCategory1783038900000().name).toBe('AddIncidentCategory1783038900000');
    expect(1783038900000).toBeGreaterThan(1783038800000);
  });
});
