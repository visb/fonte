import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Story 178 — templates genéricos (`kind`) + registro de recibos emitidos.
 *
 * `kind` nasce `'RESIDENT'` por DEFAULT e sem backfill: todo template existente
 * continua sendo documento de filho e aparece exatamente onde aparecia. O
 * isolamento do recibo é no repositório (o `findAll` filtra por `kind`, default
 * `RESIDENT`), não na tela — decisão 8 do plano.
 *
 * `receipt_type` é varchar (e não enum do Postgres), seguindo a convenção de
 * `available_for` (story 160): tipo novo de recibo (pizza, pão) não exige
 * `ALTER TYPE`. A validação contra o enum `ReceiptType` vive no service.
 *
 * O índice único PARCIAL em `receipt_type` é a decisão 2 (um template ativo por
 * tipo de recibo): o gerador ACHA o template pelo tipo, então não pode haver
 * dois — e nenhum operador escolhe template na hora de emitir.
 *
 * `issued_receipts` guarda o REGISTRO da emissão, nunca o PDF (decisões 4 e 5):
 * - `ux_issued_receipts_number` protege a sequência por tipo;
 * - `ux_issued_receipts_subject` é a idempotência — baixar o mesmo recibo duas
 *   vezes reusa o mesmo número em vez de queimar dois.
 * Sem `deleted_at` de propósito: recibo emitido não se apaga; buraco na
 * sequência é pior que registro obsoleto.
 */
export class AddTemplateKindAndIssuedReceipts1783037700000 implements MigrationInterface {
  name = 'AddTemplateKindAndIssuedReceipts1783037700000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE public.document_templates
        ADD COLUMN kind varchar NOT NULL DEFAULT 'RESIDENT',
        ADD COLUMN receipt_type varchar NULL
    `);

    await queryRunner.query(`
      CREATE UNIQUE INDEX "UX_document_templates_receipt_type"
        ON public.document_templates (receipt_type)
        WHERE receipt_type IS NOT NULL
    `);

    await queryRunner.query(`
      CREATE TABLE public.issued_receipts (
        id uuid NOT NULL DEFAULT gen_random_uuid(),
        receipt_type varchar NOT NULL,
        number integer NOT NULL,
        subject_type varchar NOT NULL,
        subject_id uuid NOT NULL,
        issued_by_user_id uuid NULL,
        created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
        CONSTRAINT "PK_issued_receipts" PRIMARY KEY (id),
        CONSTRAINT "UX_issued_receipts_number" UNIQUE (receipt_type, number),
        CONSTRAINT "UX_issued_receipts_subject" UNIQUE (receipt_type, subject_type, subject_id),
        CONSTRAINT "FK_issued_receipts_user" FOREIGN KEY (issued_by_user_id)
          REFERENCES public.users(id) ON DELETE SET NULL
      )
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS public.issued_receipts`);
    await queryRunner.query(`DROP INDEX IF EXISTS public."UX_document_templates_receipt_type"`);
    await queryRunner.query(`
      ALTER TABLE public.document_templates
        DROP COLUMN IF EXISTS receipt_type,
        DROP COLUMN IF EXISTS kind
    `);
  }
}
