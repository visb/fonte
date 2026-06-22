import { MigrationInterface, QueryRunner } from 'typeorm';

// Story 76 — templates já salvos têm URLs S3 ASSINADAS (presign, 24h) embutidas
// no <img src> do content. Elas expiram e a imagem quebra. A URL assinada ainda
// contém o caminho do objeto, então remover a query (?...X-Amz-...) recupera a
// forma canônica; a assinatura passa a ser aplicada na hora de servir.
// Idempotente: rodar de novo não altera content já canônico.
const IMG_SRC_RE = /(<img\b[^>]*?\bsrc=)(["'])(.*?)\2/gi;

function canonicalizeImageUrls(html: string): string {
  return html.replace(IMG_SRC_RE, (_m, pre: string, quote: string, src: string) => {
    const qIdx = src.indexOf('?');
    // Só remove a query quando é uma assinatura AWS — preserva qualquer query
    // legítima em imagens não-S3.
    if (qIdx >= 0 && src.includes('X-Amz-')) {
      return `${pre}${quote}${src.slice(0, qIdx)}${quote}`;
    }
    return `${pre}${quote}${src}${quote}`;
  });
}

export class NormalizeTemplateImageUrls1784100000000 implements MigrationInterface {
  name = 'NormalizeTemplateImageUrls1784100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const rows: { id: string; content: string }[] = await queryRunner.query(
      `SELECT id, content FROM document_templates WHERE content LIKE '%X-Amz-%'`,
    );
    for (const row of rows) {
      const fixed = canonicalizeImageUrls(row.content);
      if (fixed !== row.content) {
        await queryRunner.query(`UPDATE document_templates SET content = $1 WHERE id = $2`, [
          fixed,
          row.id,
        ]);
      }
    }
  }

  public async down(): Promise<void> {
    // Sem reversão: as assinaturas removidas já estavam expiradas/expirando e a
    // forma canônica é a representação correta. Nada a restaurar.
  }
}
