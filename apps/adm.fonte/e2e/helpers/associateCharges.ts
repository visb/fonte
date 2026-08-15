import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import { Client } from 'pg';

// Story 178 — o recibo só existe para cobrança PAGA, e não há rota que marque
// uma cobrança como paga (quem faz isso é o webhook do Pagar.me, que exige
// credencial de gateway). O fixture escreve a cobrança direto no banco DE TESTE
// — mesma saída que o e2e da API usa via DataSource. Nada aqui roda contra
// produção: a conexão vem do `.env.test` do serviço.

// O Playwright carrega as specs como ESM (o app é "type": "module"), então não
// há `__dirname` — daí o caminho a partir do `import.meta.url`.
const HERE = dirname(fileURLToPath(import.meta.url));
const ENV_PATH = resolve(HERE, '../../../../services/api/.env.test');

function connectionString(): string {
  const parsed = dotenv.config({ path: ENV_PATH }).parsed ?? {};
  const url = process.env.TEST_DATABASE_URL ?? parsed.DATABASE_URL;
  if (!url) {
    throw new Error(`DATABASE_URL não encontrada em ${ENV_PATH} — rode pnpm test:setup.`);
  }
  return url;
}

async function withClient<T>(fn: (client: Client) => Promise<T>): Promise<T> {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

/** Insere uma cobrança PAGA para o associado e devolve o id da cobrança. */
export function createPaidCharge(associateId: string, grossAmount = 51.75): Promise<string> {
  return withClient(async (client) => {
    const { rows } = await client.query(
      `INSERT INTO associate_charges
         (associate_id, net_amount, fee_amount, gross_amount, status, due_date, paid_at)
       VALUES ($1, $2, 1.75, $3, 'PAID', CURRENT_DATE, now())
       RETURNING id`,
      [associateId, grossAmount - 1.75, grossAmount],
    );
    return rows[0].id as string;
  });
}

/** Limpa cobranças e recibos emitidos do associado (cleanup da suíte). */
export function deleteChargesOf(associateId: string): Promise<void> {
  return withClient(async (client) => {
    await client.query(
      `DELETE FROM issued_receipts
        WHERE subject_id IN (SELECT id FROM associate_charges WHERE associate_id = $1)`,
      [associateId],
    );
    await client.query(`DELETE FROM associate_charges WHERE associate_id = $1`, [associateId]);
  });
}
