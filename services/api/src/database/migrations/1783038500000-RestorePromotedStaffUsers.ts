import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Corrige o efeito do reacolhimento sobre servos promovidos de filho.
 *
 * A promoção reaproveitava o User de kiosk do filho (vira SERVANT) sem tirar o
 * `residents.user_id`; o reacolhimento desse filho fazia `softDelete` no User,
 * derrubando o login do servo e deixando `staff.user` nulo (crash no StaffCard).
 *
 *   (a) restaura o User soft-deletado de todo staff não excluído — o único
 *       caminho que soft-deleta User de staff é a exclusão do próprio staff,
 *       que também soft-deleta a ficha;
 *   (b) desvincula do filho o User que já pertence a um staff.
 *
 * `down` é no-op: reapagar o login do servo só reintroduziria o bug.
 */
export class RestorePromotedStaffUsers1783038500000 implements MigrationInterface {
  name = 'RestorePromotedStaffUsers1783038500000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      UPDATE public.users u
         SET deleted_at = NULL
        FROM public.staff s
       WHERE s.user_id = u.id
         AND s.deleted_at IS NULL
         AND u.deleted_at IS NOT NULL
    `);

    await queryRunner.query(`
      UPDATE public.residents r
         SET user_id = NULL
        FROM public.staff s
       WHERE s.user_id = r.user_id
         AND s.deleted_at IS NULL
    `);
  }

  public async down(): Promise<void> {
    // Intencionalmente vazio — ver docstring.
  }
}
