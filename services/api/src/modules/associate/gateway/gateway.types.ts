/**
 * Contratos do gateway de pagamento recorrente (story 41 — Pagar.me).
 *
 * O resto do módulo depende SÓ desta interface; a impl HTTP (Pagar.me) fica
 * encapsulada e é trocada por mock nos testes. Nomes genéricos (`PaymentGateway`)
 * para não acoplar o domínio ao provedor — já trocamos de gateway uma vez.
 *
 * Modelo Pagar.me v5:
 *  - tokenização do cartão é client-side (tokenizecard.js + public key); o PAN
 *    nunca chega ao nosso backend (PCI/LGPD). Recebemos só o `cardToken`.
 *  - assinatura com valor inline (`items[].pricing_scheme`), sem plano pré-cadastrado;
 *  - cancelamento via DELETE /subscriptions/{id};
 *  - webhooks: charge.paid / charge.payment_failed / subscription.canceled.
 */

export interface CreateCustomerInput {
  name: string;
  email: string | null;
  /** WhatsApp em E.164. */
  phone: string;
}

export interface CreateCustomerResult {
  customerId: string;
}

export interface CreateSubscriptionInput {
  customerId: string;
  /** Token do cartão tokenizado client-side (single-use, expira em 60s). */
  cardToken: string;
  /** Valor cobrado no cartão (gross, em reais) — fixo para todas as cobranças. */
  grossAmount: number;
  /** Intervalo da recorrência (mensal por padrão). */
  interval: 'month';
  /** Id interno do associado (rastreabilidade no gateway via metadata/code). */
  externalId: string;
}

export interface CreateSubscriptionResult {
  subscriptionId: string;
  /** Id da primeira cobrança (adesão), quando o gateway já a devolve. */
  chargeId: string | null;
}

export interface CancelSubscriptionResult {
  canceled: boolean;
}

/** Método de cobrança avulsa (story 69 — pagamento único de inscrição em evento). */
export type OrderPaymentMethod = 'credit_card' | 'pix';

/**
 * Cobrança avulsa (1x) — Pagar.me `POST /orders` com uma única charge (story 69).
 * Diferente da assinatura recorrente dos associados: não cria plano, cobra uma vez.
 */
export interface CreateOrderInput {
  /** Valor cobrado (gross, em reais) — já com gross-up das taxas. */
  grossAmount: number;
  method: OrderPaymentMethod;
  /** Token do cartão tokenizado client-side (obrigatório p/ credit_card). */
  cardToken?: string;
  /** Expiração do PIX em segundos (default no gateway quando ausente). */
  pixExpiresIn?: number;
  /** Descrição do item exibida no checkout/recibo. */
  itemName: string;
  /** Id interno da inscrição (rastreabilidade no gateway via code/metadata). */
  externalId: string;
  customer?: CreateCustomerInput;
}

export interface CreateOrderResult {
  orderId: string;
  chargeId: string | null;
  /** Status devolvido pelo gateway (informativo; status final vem do webhook). */
  status: string | null;
  /** Conteúdo PIX copia-e-cola (emv), presente só p/ method = pix. */
  pixQrCode: string | null;
  /** URL da imagem do QR Code do PIX, quando o gateway a devolve. */
  pixQrCodeUrl: string | null;
  /** Expiração do PIX (ISO), quando o gateway a devolve. */
  pixExpiresAt: string | null;
}

/** Interface do gateway de pagamento. Implementação HTTP trocável por mock. */
export interface PaymentGateway {
  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription(subscriptionId: string): Promise<CancelSubscriptionResult>;
  /** Cobrança avulsa (1x): cartão ou PIX. Story 69. */
  createOrder(input: CreateOrderInput): Promise<CreateOrderResult>;
}

/** Token de injeção do gateway (permite trocar a impl por mock nos testes). */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
