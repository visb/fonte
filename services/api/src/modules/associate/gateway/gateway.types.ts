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

/** Interface do gateway de pagamento. Implementação HTTP trocável por mock. */
export interface PaymentGateway {
  createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult>;
  createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult>;
  cancelSubscription(subscriptionId: string): Promise<CancelSubscriptionResult>;
}

/** Token de injeção do gateway (permite trocar a impl por mock nos testes). */
export const PAYMENT_GATEWAY = Symbol('PAYMENT_GATEWAY');
