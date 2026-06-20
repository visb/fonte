import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MAIL_SENDER, MailSender } from '../mail/mail.types';
import {
  WHATSAPP_CLIENT,
  WhatsAppClient,
} from '../associate/whatsapp/whatsapp.types';
import { EventRegistration } from './event-registration.entity';

/**
 * Resultado dos envios do link de pagamento (story 70). Ambos best-effort:
 * `false` significa "não enviado" (sem credencial / canal ausente / falha
 * logada) — NUNCA derruba a inscrição.
 */
export interface PaymentLinkDispatch {
  email: boolean;
  whatsapp: boolean;
}

/**
 * Envia o link da página de pagamento da inscrição em evento pago (story 70) por
 * e-mail e WhatsApp. Disparado ao registrar a inscrição (best-effort) e pelo
 * endpoint admin de reenvio.
 *
 * Best-effort em ambos os canais: cada envio é independente; falha de um não
 * impede o outro e nunca lança. Sem `email` na inscrição → pula o e-mail; sem
 * telefone E.164 → pula o WhatsApp.
 */
@Injectable()
export class EventPaymentNotifierService {
  private readonly logger = new Logger(EventPaymentNotifierService.name);

  constructor(
    @Inject(MAIL_SENDER) private readonly mail: MailSender,
    @Inject(WHATSAPP_CLIENT) private readonly whatsapp: WhatsAppClient,
    private readonly config: ConfigService,
  ) {}

  /** Base pública do portal (story 58 renomeou o app). Fallback p/ associados. */
  private get portalUrl(): string {
    return (
      this.config.get<string>('PORTAL_URL') ??
      this.config.get<string>('APP_ASSOCIADOS_URL') ??
      ''
    ).replace(/\/$/, '');
  }

  /** Template Meta do link de pagamento de evento (precisa estar aprovado). */
  private get eventTemplateName(): string {
    return (
      this.config.get<string>('META_WA_TEMPLATE_EVENT_PAYMENT') ??
      'pagamento_evento'
    );
  }

  /** Monta o link público da página de pagamento da inscrição. */
  buildPaymentLink(token: string): string {
    return `${this.portalUrl}/pagamento/${token}`;
  }

  /** Telefone parece E.164 (`+` seguido de 8-15 dígitos)? */
  private isE164(value: string | null | undefined): value is string {
    return !!value && /^\+\d{8,15}$/.test(value);
  }

  /**
   * Dispara o link por e-mail (se houver) e WhatsApp (se telefone E.164). Cada
   * canal é best-effort e isolado por try/catch — nunca lança.
   */
  async sendPaymentLink(
    registration: EventRegistration,
    eventTitle: string,
  ): Promise<PaymentLinkDispatch> {
    if (!registration.paymentToken) {
      // Inscrição grátis / sem token: nada a enviar.
      return { email: false, whatsapp: false };
    }
    const link = this.buildPaymentLink(registration.paymentToken);

    const [email, whatsapp] = await Promise.all([
      this.sendEmail(registration, eventTitle, link),
      this.sendWhatsApp(registration, eventTitle, link),
    ]);

    return { email, whatsapp };
  }

  private async sendEmail(
    registration: EventRegistration,
    eventTitle: string,
    link: string,
  ): Promise<boolean> {
    if (!registration.email) return false;
    try {
      const result = await this.mail.sendMail({
        to: registration.email,
        subject: `Pagamento da inscrição — ${eventTitle}`,
        text:
          `Olá, ${registration.name}!\n\n` +
          `Recebemos sua inscrição em "${eventTitle}". ` +
          `Para concluir o pagamento, acesse o link abaixo:\n\n${link}\n\n` +
          `O link fica disponível até o pagamento ser confirmado.\n\n` +
          `Que Deus o abençoe.\nFonte de Misericórdia`,
        html:
          `<p>Olá, ${registration.name}!</p>` +
          `<p>Recebemos sua inscrição em <strong>${eventTitle}</strong>. ` +
          `Para concluir o pagamento, acesse o link abaixo:</p>` +
          `<p><a href="${link}">${link}</a></p>` +
          `<p>O link fica disponível até o pagamento ser confirmado.</p>` +
          `<p>Que Deus o abençoe.<br/>Fonte de Misericórdia</p>`,
      });
      return result.sent;
    } catch (error) {
      // Defesa extra: a impl já é best-effort, mas não deixamos vazar nada.
      this.logger.error(
        `Falha inesperada ao enviar e-mail de pagamento (registration ${registration.id})`,
        error instanceof Error ? error.stack : error,
      );
      return false;
    }
  }

  private async sendWhatsApp(
    registration: EventRegistration,
    eventTitle: string,
    link: string,
  ): Promise<boolean> {
    if (!this.isE164(registration.contact)) return false;
    try {
      const result = await this.whatsapp.sendTemplate({
        toE164: registration.contact,
        templateName: this.eventTemplateName,
        variables: [registration.name, eventTitle],
        // O cliente usa `urlLink` (link completo) direto no botão de URL (story 70).
        urlButtonParam: registration.paymentToken as string,
        urlLink: link,
      });
      return result.sent;
    } catch (error) {
      this.logger.error(
        `Falha inesperada ao enviar WhatsApp de pagamento (registration ${registration.id})`,
        error instanceof Error ? error.stack : error,
      );
      return false;
    }
  }
}
