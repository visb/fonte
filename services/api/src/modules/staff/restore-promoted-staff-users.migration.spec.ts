import { RestorePromotedStaffUsers1783038500000 } from '../../database/migrations/1783038500000-RestorePromotedStaffUsers';

/**
 * Catraca da migration que devolve o login do servo promovido apagado pelo
 * reacolhimento do filho de origem.
 */
describe('migration RestorePromotedStaffUsers', () => {
  async function runUp() {
    const sql: string[] = [];
    const queryRunner = {
      query: jest.fn(async (q: string) => {
        sql.push(q.replace(/\s+/g, ' ').trim());
      }),
    };
    await new RestorePromotedStaffUsers1783038500000().up(queryRunner as never);
    return sql;
  }

  it('restaura só o User de staff não excluído', async () => {
    const [restore] = await runUp();
    expect(restore).toContain('UPDATE public.users u SET deleted_at = NULL');
    expect(restore).toContain('s.deleted_at IS NULL');
    expect(restore).toContain('u.deleted_at IS NOT NULL');
  });

  it('desvincula do filho o User que pertence a um staff', async () => {
    const [, unlink] = await runUp();
    expect(unlink).toContain('UPDATE public.residents r SET user_id = NULL');
    expect(unlink).toContain('s.user_id = r.user_id');
  });

  it('down é no-op', async () => {
    await expect(new RestorePromotedStaffUsers1783038500000().down()).resolves.toBeUndefined();
  });
});
