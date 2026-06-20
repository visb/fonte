import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MailSender, SendMailInput, SendMailResult } from './mail.types';

/**
 * Implementação do MailService via Resend HTTP API (story 70).
 *
 * Escolhido o Resend por ser o mais simples de operar: uma única chave de API
 * (`RESEND_API_KEY`) e um endpoint HTTP (`POST https://api.resend.com/emails`),
 * sem precisar de cliente SMTP/dependência extra (usa `fetch` nativo).
 *
 * Env:
 *  - RESEND_API_KEY — chave da API do Resend.
 *  - MAIL_FROM      — remetente (ex.: `Fonte de Misericórdia <nao-responda@dominio>`).
 *
 * Best-effort: sem credencial → loga e devolve `{ sent: false }`; qualquer erro
 * (rede, rejeição do provedor) também é LOGADO e devolve `{ sent: false }` —
 * NUNCA lança.
 *
 * ⚠️ Sem `RESEND_API_KEY` no ambiente → a API real NUNCA é chamada (mock via
 * MAIL_SENDER nos testes). Ver PROGRESS.md (PENDENTE-MANUAL).
 */
@Injectable()
export class ResendMailService implements MailSender {
  private readonly logger = new Logger(ResendMailService.name);

  constructor(private readonly config: ConfigService) {}

  private get apiKey(): string | undefined {
    return this.config.get<string>('RESEND_API_KEY');
  }

  private get from(): string {
    return (
      this.config.get<string>('MAIL_FROM') ??
      'Fonte de Misericórdia <nao-responda@fontedemisericordia.org>'
    );
  }

  async sendMail(input: SendMailInput): Promise<SendMailResult> {
    const apiKey = this.apiKey;
    if (!apiKey) {
      // Sem credencial configurada: best-effort, loga e segue (não derruba o fluxo).
      this.logger.warn(
        'Email não configurado (RESEND_API_KEY ausente); pulando envio.',
      );
      return { sent: false, messageId: null };
    }

    const body = {
      from: this.from,
      to: input.to,
      subject: input.subject,
      text: input.text,
      ...(input.html ? { html: input.html } : {}),
    };

    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(body),
      });

      const json = (await res.json().catch(() => null)) as {
        id?: string;
        message?: string;
      } | null;

      if (!res.ok) {
        this.logger.error(
          `Falha ao enviar e-mail para ${input.to}: ${res.status} ${JSON.stringify(json)}`,
        );
        return { sent: false, messageId: null };
      }

      return { sent: true, messageId: json?.id ?? null };
    } catch (error) {
      this.logger.error(
        `Erro de rede ao enviar e-mail para ${input.to}`,
        error instanceof Error ? error.stack : error,
      );
      return { sent: false, messageId: null };
    }
  }
}
