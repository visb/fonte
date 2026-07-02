import { MigrationInterface, QueryRunner } from 'typeorm';

// Story 97 — o telefone do servo passa a ser semanticamente o WhatsApp, usado
// também como identificador de login (junto com a senha). RENAME preserva os
// dados existentes; nenhuma outra tabela muda (relatives.phone e
// residents.contact_phone ficam como estão).
export class StaffPhoneToWhatsapp1784500000000 implements MigrationInterface {
  name = 'StaffPhoneToWhatsapp1784500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "staff" RENAME COLUMN "phone" TO "whatsapp"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "staff" RENAME COLUMN "whatsapp" TO "phone"`);
  }
}
