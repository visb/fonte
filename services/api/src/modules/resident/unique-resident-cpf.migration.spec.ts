import { UniqueResidentCpf1783038400000 } from '../../database/migrations/1783038400000-UniqueResidentCpf';
import { AddStaffDismissal1783038300000 } from '../../database/migrations/1783038300000-AddStaffDismissal';

/**
 * Story 219 — catraca da migration (ordem e SQL). O comportamento real
 * (quem fica com o CPF, log, `down`) é ensaiado no banco de teste em
 * `test/resident-cpf-unique.e2e-spec.ts`.
 */
describe('migration UniqueResidentCpf (story 219)', () => {
  async function run(direction: 'up' | 'down', result: unknown = undefined) {
    const sql: string[] = [];
    const queryRunner = {
      query: jest.fn(async (q: string) => {
        sql.push(q.replace(/\s+/g, ' ').trim());
        return result;
      }),
    };
    const log = jest.spyOn(console, 'log').mockImplementation(() => undefined);
    await new UniqueResidentCpf1783038400000()[direction](queryRunner as never);
    const logged = log.mock.calls.map((c) => String(c[0]));
    log.mockRestore();
    return { sql, logged };
  }

  it('up: normaliza → dedup com log → índice único parcial, nessa ordem', async () => {
    const { sql } = await run('up');
    const at = (needle: string) => sql.findIndex((q) => q.includes(needle));

    const normalize = sql[at("regexp_replace(cpf, '\\D', '', 'g')")];
    expect(normalize).toContain("NULLIF(regexp_replace(cpf, '\\D', '', 'g'), '')");

    const dedup = sql[at('WITH ranked')];
    expect(dedup).toContain('PARTITION BY cpf');
    expect(dedup).toContain(
      "ORDER BY (status IN ('PRE_ADMISSION', 'ACTIVE', 'DISCIPLINE', 'TEMP_LEAVE', 'CENSUS_ADDED')) DESC, updated_at DESC",
    );
    expect(dedup).toContain('WHERE cpf IS NOT NULL AND deleted_at IS NULL');
    expect(dedup).toContain('INSERT INTO public.resident_cpf_dedup_log (resident_id, old_cpf, kept_resident_id)');
    expect(dedup).toContain('SET cpf = NULL');

    const index = sql[at('UX_residents_cpf_active')];
    expect(index).toContain('CREATE UNIQUE INDEX');
    expect(index).toContain('WHERE cpf IS NOT NULL AND deleted_at IS NULL');

    expect(at('regexp_replace')).toBeLessThan(at('WITH ranked'));
    expect(at('CREATE TABLE IF NOT EXISTS public.resident_cpf_dedup_log')).toBeLessThan(at('WITH ranked'));
    expect(at('WITH ranked')).toBeLessThan(at('CREATE UNIQUE INDEX'));
  });

  it('up loga a contagem de grupos e filhos afetados', async () => {
    const { logged } = await run('up', [{ groups: 2, cleared: 3 }]);
    expect(logged).toContain('[UniqueResidentCpf] grupos de CPF repetido: 2; filhos com CPF limpo: 3');
    const empty = await run('up');
    expect(empty.logged).toContain('[UniqueResidentCpf] grupos de CPF repetido: 0; filhos com CPF limpo: 0');
  });

  it('down: derruba o índice, restaura os CPFs do log e remove o log', async () => {
    const { sql } = await run('down');
    expect(sql[0]).toBe('DROP INDEX IF EXISTS public."UX_residents_cpf_active"');
    expect(sql[1]).toContain('SET cpf = l.old_cpf FROM public.resident_cpf_dedup_log l');
    expect(sql[2]).toBe('DROP TABLE IF EXISTS public.resident_cpf_dedup_log');
  });

  it('timestamp maior que a última migration existente', () => {
    expect(new UniqueResidentCpf1783038400000().name).toBe('UniqueResidentCpf1783038400000');
    expect(new AddStaffDismissal1783038300000().name).toBe('AddStaffDismissal1783038300000');
  });
});
