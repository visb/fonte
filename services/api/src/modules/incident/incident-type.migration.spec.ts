import { AddIncidentType1783038800000 } from '../../database/migrations/1783038800000-AddIncidentType';

/** Story 229 — catraca da migration: tipo com backfill NEGATIVE, drop da severidade, down reverso. */
describe('migration AddIncidentType (story 229)', () => {
  function run(direction: 'up' | 'down') {
    const sql: string[] = [];
    const queryRunner = { query: jest.fn(async (q: string) => void sql.push(q.replace(/\s+/g, ' ').trim())) };
    const migration = new AddIncidentType1783038800000();
    return migration[direction](queryRunner as never).then(() => sql);
  }

  it('up cria o enum e a coluna com backfill NEGATIVE, depois remove o default', async () => {
    const sql = await run('up');
    expect(sql[0]).toContain("CREATE TYPE public.incident_type AS ENUM ('POSITIVE', 'NEGATIVE')");
    expect(sql[1]).toContain("type public.incident_type NOT NULL DEFAULT 'NEGATIVE'");
    expect(sql[2]).toBe('ALTER TABLE public.incidents ALTER COLUMN type DROP DEFAULT');
  });

  it('up só derruba a severidade DEPOIS do backfill do tipo', async () => {
    const sql = await run('up');
    const add = sql.findIndex((q) => q.includes('ADD COLUMN IF NOT EXISTS type'));
    const drop = sql.findIndex((q) => q.includes('DROP COLUMN IF EXISTS severity'));
    expect(add).toBeGreaterThan(-1);
    expect(drop).toBeGreaterThan(add);
    expect(sql[sql.length - 1]).toBe('DROP TYPE IF EXISTS public.incident_severity_enum');
  });

  it('down recria a severidade como MEDIUM e remove o tipo', async () => {
    const sql = await run('down');
    expect(sql[0]).toContain("CREATE TYPE public.incident_severity_enum AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL')");
    expect(sql[1]).toContain("severity public.incident_severity_enum NOT NULL DEFAULT 'MEDIUM'");
    expect(sql[2]).toBe('ALTER TABLE public.incidents ALTER COLUMN severity DROP DEFAULT');
    expect(sql[3]).toBe('ALTER TABLE public.incidents DROP COLUMN IF EXISTS type');
    expect(sql[4]).toBe('DROP TYPE IF EXISTS public.incident_type');
  });

  it('timestamp maior que a última migration (story 227)', () => {
    expect(new AddIncidentType1783038800000().name).toBe('AddIncidentType1783038800000');
    expect(1783038800000).toBeGreaterThan(1783038700000);
  });
});
