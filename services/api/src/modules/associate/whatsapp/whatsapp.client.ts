import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  SendTemplateInput,
  SendTemplateResult,
  WhatsAppClient,
} from './whatsapp.types';

/**
 * Implementação HTTP do cliente WhatsApp (Meta Cloud API).
 *
 * Endpoint: POST https://graph.facebook.com/<API_VERSION>/<PHONE_NUMBER_ID>/messages
 * Autenticação: header `Authorization: Bearer <META_WA_TOKEN>`.
 *
 * Env:
 *  - META_WA_PHONE_NUMBER_ID  — id do número remetente registrado na Meta.
 *  - META_WA_TOKEN            — token de acesso permanente (system user).
 *  - META_WA_TEMPLATE_NAME    — nome do template aprovado (fallback p/ sendTemplate).
 *  - META_WA_API_VERSION      — versão da Graph API (default `v21.0`).
 *  - APP_ASSOCIADOS_URL       — base do app público; o link é `<base>/p/<payment_token>`.
 *
 * Best-effort: qualquer falha (sem credencial, erro de rede, rejeição da Meta) é
 * LOGADA e devolve `{ sent: false }` — NUNCA derruba o job de cobrança.
 *
 * ⚠️ Sem credencial Meta no ambiente → a API real nunca é chamada nos testes
 * (mock via WHATSAPP_CLIENT). Ver PROGRESS.md.
 */
@Injectable()
export class MetaWhatsAppClient implements WhatsAppClient {
  private readonly logger = new Logger(MetaWhatsAppClient.name);

  constructor(private readonly config: ConfigService) {}

  private get apiVersion(): string {
    return this.config.get<string>('META_WA_API_VERSION') ?? 'v21.0';
  }

  private get phoneNumberId(): string | undefined {
    return this.config.get<string>('META_WA_PHONE_NUMBER_ID');
  }

  private get token(): string | undefined {
    return this.config.get<string>('META_WA_TOKEN');
  }

  private get appAssociadosUrl(): string {
    return (this.config.get<string>('APP_ASSOCIADOS_URL') ?? '').replace(/\/$/, '');
  }

  /** Monta o link público da página de pagamento a partir do payment_token. */
  buildPaymentLink(paymentToken: string): string {
    return `${this.appAssociadosUrl}/p/${paymentToken}`;
  }

  async sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult> {
    const phoneNumberId = this.phoneNumberId;
    const token = this.token;

    if (!phoneNumberId || !token) {
      // Sem credencial configurada: best-effort, loga e segue (não derruba o job).
      this.logger.warn(
        'WhatsApp não configurado (META_WA_PHONE_NUMBER_ID/META_WA_TOKEN ausentes); pulando envio.',
      );
      return { sent: false, messageId: null };
    }

    const link = this.buildPaymentLink(input.urlButtonParam);
    const body = {
      messaging_product: 'whatsapp',
      to: input.toE164,
      type: 'template',
      template: {
        name: input.templateName,
        language: { code: 'pt_BR' },
        components: [
          {
            type: 'body',
            parameters: input.variables.map((text) => ({ type: 'text', text })),
          },
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            // No template de URL dinâmica, o parâmetro completa o sufixo da URL.
            // Enviamos o link inteiro como referência; a Meta concatena ao
            // template conforme configurado. Guardamos o token como parâmetro.
            parameters: [{ type: 'text', text: link }],
          },
        ],
      },
    };

    try {
      const res = await fetch(
        `https://graph.facebook.com/${this.apiVersion}/${phoneNumberId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(body),
        },
      );

      const json = (await res.json().catch(() => null)) as {
        messages?: Array<{ id?: string }>;
        error?: unknown;
      } | null;

      if (!res.ok || json?.error) {
        this.logger.error(
          `Falha ao enviar template WhatsApp para ${input.toE164}: ${res.status} ${JSON.stringify(json?.error)}`,
        );
        return { sent: false, messageId: null };
      }

      return { sent: true, messageId: json?.messages?.[0]?.id ?? null };
    } catch (error) {
      this.logger.error(
        `Erro de rede ao enviar template WhatsApp para ${input.toE164}`,
        error instanceof Error ? error.stack : error,
      );
      return { sent: false, messageId: null };
    }
  }
}
