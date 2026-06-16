import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CancelSubscriptionResult,
  CreateCustomerInput,
  CreateCustomerResult,
  CreateSubscriptionInput,
  CreateSubscriptionResult,
  PaymentGateway,
} from './gateway.types';

/**
 * Implementação HTTP do gateway Pagar.me (API v5).
 *
 * Base `https://api.pagar.me/core/v5` (https://docs.pagar.me/reference).
 * Autenticação: HTTP Basic com a secret key como usuário e senha vazia →
 * `Authorization: Basic base64("<secret>:")`.
 *
 * Endpoints:
 *  - POST   /customers
 *  - POST   /subscriptions      (assinatura com valor inline via pricing_scheme)
 *  - DELETE /subscriptions/{id} (cancelamento)
 *
 * NÃO há chave configurada no ambiente ainda — a impl está pronta mas a validação
 * real em sandbox é pendência manual (ver PROGRESS.md). Os testes usam um mock
 * desta interface; a API real nunca é chamada na suíte.
 */
@Injectable()
export class HttpPagarmeGateway implements PaymentGateway {
  private readonly logger = new Logger(HttpPagarmeGateway.name);

  constructor(private readonly config: ConfigService) {}

  private get baseUrl(): string {
    return (
      this.config.get<string>('PAGARME_BASE_URL') ?? 'https://api.pagar.me/core/v5'
    ).replace(/\/$/, '');
  }

  private get authHeader(): string {
    const key = this.config.get<string>('PAGARME_SECRET_KEY');
    if (!key) {
      // Sem chave: falha explícita em vez de chamar a API anonimamente.
      throw new ServiceUnavailableException(
        'Integração Pagar.me não configurada (PAGARME_SECRET_KEY ausente).',
      );
    }
    return `Basic ${Buffer.from(`${key}:`).toString('base64')}`;
  }

  private async request<T>(method: 'POST' | 'DELETE', path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.authHeader,
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    const json = (await res.json().catch(() => null)) as Record<string, unknown> | null;

    if (!res.ok) {
      this.logger.error(`Pagar.me ${method} ${path} failed: ${res.status} ${JSON.stringify(json)}`);
      throw new ServiceUnavailableException('Falha na comunicação com o gateway de pagamento.');
    }
    return json as T;
  }

  async createCustomer(input: CreateCustomerInput): Promise<CreateCustomerResult> {
    const data = await this.request<{ id: string }>('POST', '/customers', {
      name: input.name,
      email: input.email ?? undefined,
      type: 'individual',
      phones: { mobile_phone: this.toPagarmePhone(input.phone) },
    });
    return { customerId: data.id };
  }

  async createSubscription(input: CreateSubscriptionInput): Promise<CreateSubscriptionResult> {
    // Valor inline (sem plano): items[].pricing_scheme.price em centavos.
    const data = await this.request<{
      id: string;
      current_cycle?: { id?: string };
      charges?: Array<{ id?: string }>;
    }>('POST', '/subscriptions', {
      customer_id: input.customerId,
      card_token: input.cardToken,
      payment_method: 'credit_card',
      interval: input.interval,
      interval_count: 1,
      billing_type: 'prepaid',
      code: input.externalId,
      metadata: { associate_id: input.externalId },
      items: [
        {
          quantity: 1,
          name: 'Contribuição mensal — Fonte de Misericórdia',
          pricing_scheme: {
            scheme_type: 'unit',
            price: Math.round(input.grossAmount * 100),
          },
        },
      ],
    });
    return {
      subscriptionId: data.id,
      chargeId: data.charges?.[0]?.id ?? null,
    };
  }

  async cancelSubscription(subscriptionId: string): Promise<CancelSubscriptionResult> {
    await this.request('DELETE', `/subscriptions/${subscriptionId}`);
    return { canceled: true };
  }

  /** E.164 (+5511999999999) → { country_code, area_code, number } do Pagar.me. */
  private toPagarmePhone(e164: string): {
    country_code: string;
    area_code: string;
    number: string;
  } {
    const digits = e164.replace(/\D/g, '');
    // Assume Brasil: 55 + DDD(2) + número(8-9).
    const withoutCountry = digits.startsWith('55') ? digits.slice(2) : digits;
    return {
      country_code: '55',
      area_code: withoutCountry.slice(0, 2),
      number: withoutCountry.slice(2),
    };
  }
}
