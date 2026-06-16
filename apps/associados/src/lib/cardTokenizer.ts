/**
 * Tokenização de cartão isolada atrás de uma interface.
 *
 * REGRA PCI/LGPD: o PAN (número do cartão) NUNCA pode chegar ao nosso backend.
 * A tokenização acontece client-side, direto no AbacatePay, e só o `cardToken`
 * resultante é enviado ao nosso `POST /public/associates/:token/subscribe`.
 *
 * ⚠️ STUB: o ambiente NÃO tem o SDK/iframe nem a chave pública real do AbacatePay.
 * Enquanto isso, em DEV (sem VITE_ABACATEPAY_PUBLIC_KEY) devolvemos um cardToken
 * fake para deixar todo o fluxo/UI prontos. A implementação real deve substituir
 * `tokenizeWithStub` por uma chamada ao SDK do gateway — ver TODO abaixo.
 */

export interface CardData {
  number: string;
  holderName: string;
  expMonth: string;
  expYear: string;
  cvv: string;
}

export interface CardTokenizer {
  /** Modo real (SDK do gateway) ou stub de desenvolvimento. */
  readonly mode: 'real' | 'stub';
  tokenize(card: CardData): Promise<string>;
}

const PUBLIC_KEY = import.meta.env.VITE_ABACATEPAY_PUBLIC_KEY ?? '';

async function tokenizeWithStub(card: CardData): Promise<string> {
  // Stub determinístico só para DEV. Não faz nenhuma chamada externa.
  await new Promise((resolve) => setTimeout(resolve, 400));
  const last4 = card.number.replace(/\D/g, '').slice(-4) || '0000';
  return `dev_tok_${last4}_${Date.now()}`;
}

async function tokenizeWithGateway(_card: CardData): Promise<string> {
  // TODO(story-38/40): integrar o SDK/iframe de tokenização do AbacatePay.
  // Carregar o SDK com VITE_ABACATEPAY_PUBLIC_KEY, montar o campo de cartão no
  // domínio do gateway (iframe) e chamar a API de tokenização para obter o token.
  // O PAN não deve transitar por este app fora do iframe do gateway.
  throw new Error(
    'Tokenização real do AbacatePay ainda não configurada (defina VITE_ABACATEPAY_PUBLIC_KEY e integre o SDK).',
  );
}

export const cardTokenizer: CardTokenizer = {
  mode: PUBLIC_KEY ? 'real' : 'stub',
  tokenize: PUBLIC_KEY ? tokenizeWithGateway : tokenizeWithStub,
};
