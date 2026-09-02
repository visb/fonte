import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as dotenv from 'dotenv';
import { Client } from 'pg';
import type { APIRequestContext } from '@playwright/test';
import { API_URL } from './api';

/**
 * Story 193 — fixture do carnê para a suíte de recibos.
 *
 * O filho e o pagamento são criados pela API (há rota para os dois); só a
 * limpeza dos `issued_receipts` precisa do banco, porque recibo emitido não tem
 * rota de exclusão de propósito (número emitido não volta ao estoque). Mesma
 * conexão de teste do `associateCharges.ts`.
 */
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

export interface PaidReceivableFixture {
  residentId: string;
  residentName: string;
  receivableId: string;
}

/**
 * Cria um filho com plano de contribuição e paga a primeira parcela do carnê.
 * Fixture da própria suíte (story 182): o seed é somente leitura.
 */
export async function createResidentWithPaidReceivable(
  request: APIRequestContext,
  token: string,
  name: string,
): Promise<PaidReceivableFixture> {
  const headers = { Authorization: `Bearer ${token}` };

  const houses = await request.get(`${API_URL}/houses`, { headers });
  const house = ((await houses.json()) as { id: string; name: string }[])[0];
  if (!house) throw new Error('Nenhuma casa disponível no banco de teste.');

  const created = await request.post(`${API_URL}/residents`, {
    headers,
    data: {
      name,
      houseId: house.id,
      entryDate: new Date().toISOString().slice(0, 10),
      familyInvestment: 'PAYMENT_700',
      contributionDueDay: 10,
    },
  });
  if (!created.ok()) {
    throw new Error(`Falha ao criar o filho (${created.status()}): ${await created.text()}`);
  }
  const residentId = (await created.json()).id as string;

  const list = await request.get(`${API_URL}/residents/${residentId}/receivables`, { headers });
  const receivableId = ((await list.json()) as { id: string }[])[0]?.id;
  if (!receivableId) throw new Error('O carnê do filho de teste nasceu vazio.');

  const paid = await request.post(
    `${API_URL}/residents/${residentId}/receivables/${receivableId}/payment`,
    {
      headers,
      multipart: {
        paidAt: new Date().toISOString().slice(0, 10),
        paymentMethod: 'PIX',
        paidAmount: '700',
      },
    },
  );
  if (!paid.ok()) {
    throw new Error(`Falha ao registrar o pagamento (${paid.status()}): ${await paid.text()}`);
  }

  return { residentId, residentName: name, receivableId };
}

/** Remove o filho da fixture e o registro de recibo emitido da parcela. */
export async function deleteResidentFixture(
  request: APIRequestContext,
  token: string,
  fixture: PaidReceivableFixture,
): Promise<void> {
  const client = new Client({ connectionString: connectionString() });
  await client.connect();
  try {
    await client.query(`DELETE FROM issued_receipts WHERE subject_id = ANY($1)`, [
      [fixture.receivableId],
    ]);
  } finally {
    await client.end();
  }
  await request.delete(`${API_URL}/residents/${fixture.residentId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
}
