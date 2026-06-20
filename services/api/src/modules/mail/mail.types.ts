/**
 * Contratos do MailService (story 70).
 *
 * Email transacional simples (sem engine de template): corpo de texto/HTML com o
 * link. Usado para enviar o link da página de pagamento da inscrição em evento
 * pago. Best-effort, igual ao WhatsApp ([[39]]): falha (sem credencial, erro de
 * rede, rejeição do provedor) é LOGADA e devolve `{ sent: false }` — NUNCA lança,
 * nunca derruba a inscrição.
 *
 * ⚠️ Não há credencial SMTP/Resend configurada no ambiente. A impl está pronta,
 * mas o provedor real NUNCA é chamado na suíte de testes (mock via DI token).
 */

export interface SendMailInput {
  /** Destinatário (e-mail). */
  to: string;
  /** Assunto da mensagem. */
  subject: string;
  /** Corpo em texto puro (fallback). */
  text: string;
  /** Corpo em HTML (opcional). */
  html?: string;
}

export interface SendMailResult {
  /** true quando o provedor aceitou a mensagem; false em best-effort (falha logada). */
  sent: boolean;
  /** Id da mensagem retornado pelo provedor, quando disponível. */
  messageId: string | null;
}

/**
 * Interface do remetente de e-mail. O resto do app depende SÓ desta interface —
 * a impl (SMTP/Resend) fica encapsulada e é trocada por mock nos testes.
 */
export interface MailSender {
  sendMail(input: SendMailInput): Promise<SendMailResult>;
}

/** Token de injeção do remetente (permite trocar a impl por mock nos testes). */
export const MAIL_SENDER = Symbol('MAIL_SENDER');
