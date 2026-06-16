/**
 * Tokenização de cartão (story 41 — Pagar.me) isolada atrás de uma interface.
 *
 * REGRA PCI/LGPD: o PAN (número do cartão) NUNCA pode chegar ao nosso backend.
 * A tokenização é client-side: enviamos os dados do cartão DIRETO para a API da
 * Pagar.me usando a CHAVE PÚBLICA (appId, `pk_...`), e só o `cardToken` resultante
 * é mandado ao nosso `POST /public/associates/:token/subscribe`.
 *
 * Endpoint: `POST {API}/tokens?appId=<public_key>` (autenticado só pela chave
 * pública — seguro no frontend). Em DEV, sem `VITE_PAGARME_PUBLIC_KEY`, usamos um
 * stub que devolve um token fake para destravar a UI sem cobrar de verdade.
 */

export interface CardData {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

export interface CardTokenizer {
  /** Modo real (Pagar.me) ou stub de desenvolvimento. */
  readonly mode: 'real' | 'stub';
  tokenize(card: CardData): Promise<string>;
}

const PUBLIC_KEY = import.meta.env.VITE_PAGARME_PUBLIC_KEY ?? '';
const API_URL = (import.meta.env.VITE_PAGARME_API_URL ?? 'https://api.pagar.me/core/v5').replace(
  /\/$/,
  '',
);

async function tokenizeWithStub(card: CardData): Promise<string> {
  // Stub determinístico só para DEV. Não faz nenhuma chamada externa.
  await new Promise((resolve) => setTimeout(resolve, 300));
  const last4 = card.number.replace(/\D/g, '').slice(-4) || '0000';
  return `dev_tok_${last4}_${Date.now()}`;
}

async function tokenizeWithGateway(card: CardData): Promise<string> {
  // PAN trafega do navegador direto para a Pagar.me (nunca para o nosso backend).
  const res = await fetch(`${API_URL}/tokens?appId=${encodeURIComponent(PUBLIC_KEY)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'card',
      card: {
        number: card.number.replace(/\s/g, ''),
        holder_name: card.holderName,
        exp_month: Number(card.expMonth),
        exp_year: Number(card.expYear),
        cvv: card.cvv,
      },
    }),
  });

  if (!res.ok) {
    throw new Error('Não foi possível validar o cartão. Verifique os dados e tente novamente.');
  }
  const data = (await res.json()) as { id?: string };
  if (!data.id) {
    throw new Error('Resposta inesperada do gateway ao tokenizar o cartão.');
  }
  return data.id;
}

export const cardTokenizer: CardTokenizer = {
  mode: PUBLIC_KEY ? 'real' : 'stub',
  tokenize: PUBLIC_KEY ? tokenizeWithGateway : tokenizeWithStub,
};
