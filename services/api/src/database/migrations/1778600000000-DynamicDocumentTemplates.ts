import { MigrationInterface, QueryRunner } from 'typeorm';

const IMAGE_AUTHORIZATION_HTML = `<h2>TERMO DE AUTORIZAÇÃO DE USO DE IMAGEM</h2><p>Eu, <strong>{{name}}</strong>, portador(a) do CPF <strong>{{cpf}}</strong>, residente na Casa <strong>{{house}}</strong> desde <strong>{{entryDate}}</strong>, autorizo a Comunidade Terapêutica Fonte de Misericórdia a utilizar minha imagem fotográfica, em vídeo ou outro meio audiovisual, exclusivamente para fins institucionais, educativos e de evangelização, sem fins comerciais, em âmbito nacional e por prazo indeterminado.</p><p>A presente autorização inclui o uso em materiais impressos, redes sociais, website institucional e eventos promovidos pela organização.</p><p>_____________________, ______ de ______________ de ______.</p><p> </p><p>___________________________________</p><p>Assinatura do Acolhido — {{name}}</p><p> </p><p>___________________________________</p><p>Assinatura do Coordenador(a)</p>`;

const COMMUNITY_RULES_HTML = `<h2>REGRAS DE PERMANÊNCIA NA COMUNIDADE</h2><p>Eu, <strong>{{name}}</strong>, declaro que recebi, li e compreendi as Regras de Permanência da Comunidade <strong>{{house}}</strong> e me comprometo a cumpri-las integralmente.</p><ol><li><p>Respeitar os coordenadores, monitores e demais acolhidos.</p></li><li><p>Participar de todas as atividades programadas (cultos, estudos, tarefas).</p></li><li><p>Manter o dormitório, banheiros e áreas comuns limpos e organizados.</p></li><li><p>Não utilizar aparelhos celulares ou eletrônicos sem autorização.</p></li><li><p>Não consumir, portar ou negociar substâncias psicoativas.</p></li><li><p>Guardar silêncio nos horários determinados.</p></li><li><p>Cumprir os horários de refeição, trabalho e descanso.</p></li><li><p>Comunicar qualquer problema de saúde imediatamente aos responsáveis.</p></li><li><p>Não ausentar-se da casa sem autorização formal.</p></li><li><p>Qualquer descumprimento será avaliado pela coordenação e poderá resultar em medidas disciplinares ou desligamento.</p></li></ol><p>_____________________, ______ de ______________ de ______.</p><p> </p><p>___________________________________</p><p>Assinatura do Acolhido — {{name}}</p>`;

const FAMILY_RULES_HTML = `<h2>REGRAS PARA AS FAMÍLIAS</h2><p><strong>Familiar/responsável pelo acolhido:</strong> {{name}} — Casa: {{house}}</p><ol><li><p>As visitas são permitidas somente nos dias e horários estabelecidos pela coordenação.</p></li><li><p>Familiares devem se identificar à entrada e aguardar autorização.</p></li><li><p>É proibido trazer ou enviar substâncias psicoativas, bebidas alcoólicas ou tabaco.</p></li><li><p>Não é permitido trazer alimentos ou objetos sem autorização prévia da coordenação.</p></li><li><p>As conversas durante as visitas devem ser realizadas em local designado.</p></li><li><p>É proibido trazer aparelhos eletrônicos para o acolhido sem autorização.</p></li><li><p>Comportamento respeitoso é obrigatório com todos os membros da comunidade.</p></li><li><p>Qualquer informação sobre o estado do acolhido deve ser solicitada à coordenação.</p></li><li><p>O não cumprimento destas regras poderá resultar na suspensão das visitas.</p></li></ol><p>_____________________, ______ de ______________ de ______.</p><p> </p><p>___________________________________</p><p>Assinatura do Familiar</p><p>Nome: ___________________________</p><p>Parentesco: ______________________</p><p> </p><p>___________________________________</p><p>Assinatura do Coordenador(a)</p>`;

export class DynamicDocumentTemplates1778600000000 implements MigrationInterface {
  name = 'DynamicDocumentTemplates1778600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // Limpa as tabelas dependentes primeiro
    await queryRunner.query(`DROP TABLE IF EXISTS "resident_documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_templates"`);
    await queryRunner.query(`DROP TYPE IF EXISTS "public"."document_templates_type_enum"`);

    await queryRunner.query(`
      CREATE TABLE "document_templates" (
        "id"          uuid        NOT NULL DEFAULT uuid_generate_v4(),
        "name"        varchar     NOT NULL,
        "content"     text        NOT NULL,
        "is_required" boolean     NOT NULL DEFAULT false,
        "updated_at"  TIMESTAMP   NOT NULL DEFAULT now(),
        CONSTRAINT "PK_document_templates" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_document_templates_name" UNIQUE ("name")
      )
    `);

    await queryRunner.query(`
      CREATE TABLE "resident_documents" (
        "id"              uuid      NOT NULL DEFAULT uuid_generate_v4(),
        "resident_id"     uuid      NOT NULL,
        "template_id"     uuid      NOT NULL,
        "signed_file_url" character varying,
        "created_at"      TIMESTAMP NOT NULL DEFAULT now(),
        "updated_at"      TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_resident_documents" PRIMARY KEY ("id"),
        CONSTRAINT "UQ_resident_documents_resident_template" UNIQUE ("resident_id", "template_id"),
        CONSTRAINT "FK_resident_documents_resident"
          FOREIGN KEY ("resident_id") REFERENCES "residents"("id") ON DELETE CASCADE,
        CONSTRAINT "FK_resident_documents_template"
          FOREIGN KEY ("template_id") REFERENCES "document_templates"("id") ON DELETE CASCADE
      )
    `);

    await queryRunner.query(
      `INSERT INTO "document_templates" ("name", "content", "is_required") VALUES ($1, $2, $3), ($4, $5, $6), ($7, $8, $9)`,
      [
        'Termo de Autorização de Uso de Imagem', IMAGE_AUTHORIZATION_HTML, true,
        'Regras de Permanência na Comunidade',   COMMUNITY_RULES_HTML,    true,
        'Regras para as Famílias',               FAMILY_RULES_HTML,       true,
      ],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS "resident_documents"`);
    await queryRunner.query(`DROP TABLE IF EXISTS "document_templates"`);
  }
}
