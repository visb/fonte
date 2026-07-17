import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 128 — assinatura do usuário logado nos documentos gerados. Cada staff
 * configura a própria assinatura (imagem PNG transparente) uma vez no perfil; a
 * URL canônica (sem assinatura de acesso, que expira) fica em `signature_url` e
 * é resolvida assinada na leitura (regra da story 76).
 */
export class StaffSignature1783037100000 implements MigrationInterface {
  name = 'StaffSignature1783037100000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.staff ADD COLUMN signature_url varchar NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE public.staff DROP COLUMN signature_url`);
  }
}
