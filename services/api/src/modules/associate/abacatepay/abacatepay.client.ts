import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  AbacatePayClient,
  CancelSubscriptionResult,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
} from './abacatepay.types';

/**
 * Implementação HTTP do cliente AbacatePay (API v2).
 *
 * Endpoints (https://docs.abacatepay.com, base `https://api.abacatepay.com/v2`):
 *  - POST /customers/create
 *  - POST /subscriptions/create
 *  - POST /subscriptions/cancel
 *
 * Autenticação: header `Authorization: Bearer <ABACATEPAY_API_KEY>`.
 *
 * NÃO há chave configurada no ambiente ainda — esta impl está pronta mas a
 * validação real em sandbox é uma pendência manual (ver PROGRESS.md). Os testes
 * usam um mock desta interface; a API real nunca é chamada na suíte.
 */
@Injectable()
export class HttpAbacatePayClient implements AbacatePayClient {
  private readonly logger = new Logger(HttpAbacatePayClient.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return (
      this.config.get<string>('ABACATEPAY_BASE_URL') ?? 'https://api.abacatepay.com/v2'
    ).replace(/\/$/, '');
  }

  private get apiKey(): string {
    const key = this.config.get<string>('ABACATEPAY_API_KEY');
    if (!key) {
      // Sem chave configurada: falha explícita em vez de chamar a API anonimamente.
      throw new ServiceUnavailableException(
        'Integração AbacatePay não configurada (ABACATEPAY_API_KEY ausente).',
      );
    }
    return key;
  }

  private async post<T>(path: string, body: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    const json = (await res.json().catch(() => null)) as
      | { data?: unknown; error?: unknown; success?: boolean }
      | null;

    if (!res.ok || json?.error) {
      this.logger.error(`AbacatePay ${path} failed: ${res.status} ${JSON.stringify(json?.error)}`);
      throw new ServiceUnavailableException('Falha na comunicação com o gateway de pagamento.');
    }
    return (json?.data ?? json) as T;
  }

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    const data = await this.post<{ id: string }>('/customers/create', {
      name: input.name,
      email: input.email,
      cellphone: input.cellphone,
    });
    return { customerId: data.id };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    // amount em centavos (padrão do gateway).
    const data = await this.post<{
      id: string;
      url?: string;
      charge?: { id?: string };
    }>('/subscriptions/create', {
      customerId: input.customerId,
      cardToken: input.cardToken,
      amount: Math.round(input.grossAmount * 100),
      dueDay: input.dueDay,
      externalId: input.externalId,
      methods: ['CARD'],
    });
    return {
      subscriptionId: data.id,
      chargeId: data.charge?.id ?? null,
      checkoutUrl: data.url ?? null,
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<CancelSubscriptionResult> {
    await this.post('/subscriptions/cancel', { subscriptionId });
    return { canceled: true };
  }
}
