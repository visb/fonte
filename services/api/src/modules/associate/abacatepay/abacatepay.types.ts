/**
 * Contratos do gateway AbacatePay (story 38).
 *
 * Premissa confirmada na doc oficial (https://docs.abacatepay.com):
 *  - cartão de crédito + assinatura recorrente mensal (POST /v2/subscriptions/create);
 *  - clientes (POST /v2/customers/create);
 *  - webhooks de eventos (subscription.completed / .renewed / .cancelled, checkout.completed);
 *  - taxa de cartão 3,5% + R$ 0,60 (configurável por env para o gross-up).
 *
 * O cartão é tokenizado client-side na página hosted do gateway — o PAN nunca chega
 * ao nosso backend (PCI/LGPD). Guardamos apenas ids/tokens do gateway.
 */

export interface CreateCustomerInput {
  name: string;
  email: string | null;
  /** WhatsApp em E.164; o gateway chama de `cellphone`. */
  cellphone: string;
}

export interface CreateCustomerResult {
  customerId: string;
}

export interface CreateSubscriptionInput {
  customerId: string;
  /** Token do cartão tokenizado client-side. */
  cardToken: string;
  /** Valor cobrado no cartão (gross), em reais. */
  grossAmount: number;
  /** Dia de vencimento (1–31). */
  dueDay: number;
  /** Id interno do associado (rastreabilidade no gateway). */
  externalId: string;
}

export interface CreateSubscriptionResult {
  subscriptionId: string;
  /** Id da primeira cobrança (adesão), quando o gateway já a devolve. */
  chargeId: string | null;
  /** URL de checkout hosted, quando o fluxo for por redirecionamento. */
  checkoutUrl: string | null;
}

export interface CancelSubscriptionResult {
  canceled: boolean;
}

/**
 * Interface do cliente AbacatePay. O resto do módulo depende SÓ desta interface —
 * a impl HTTP fica encapsulada e é trocada por mock nos testes.
 */
export interface AbacatePayClient {
  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription(subscriptionId: string): Promise<CancelSubscriptionResult>;
}

/** Token de injeção do cliente (permite trocar a impl por mock nos testes). */
export const ABACATEPAY_CLIENT = Symbol('ABACATEPAY_CLIENT');
