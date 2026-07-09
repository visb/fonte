import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Torna `house_id` opcional em residents e admissions: filho ARCHIVED (import
 * em lote sem correspondência na planilha) pode não ter casa conhecida. Para os
 * demais status a obrigatoriedade segue garantida no DTO (`@ValidateIf`).
 */
export class AllowNullResidentHouse1783036900000 implements MigrationInterface {
  name = 'AllowNullResidentHouse1783036900000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.residents ALTER COLUMN house_id DROP NOT NULL`);
    await queryRunner.query(`ALTER TABLE public.admissions ALTER COLUMN house_id DROP NOT NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Falha se existirem linhas com house_id nulo — intencional: reverter exige
    // decidir o destino desses registros antes.
    await queryRunner.query(`ALTER TABLE public.admissions ALTER COLUMN house_id SET NOT NULL`);
    await queryRunner.query(`ALTER TABLE public.residents ALTER COLUMN house_id SET NOT NULL`);
  }
}
