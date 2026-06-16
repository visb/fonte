/**
 * Contratos do cliente WhatsApp (Meta Cloud API — story 39).
 *
 * A Fonte usa a API oficial da Meta (Cloud API). Para INICIAR conversa é
 * obrigatório um TEMPLATE aprovado pela Meta. O template de cobrança tem um
 * botão de URL dinâmica que recebe o `payment_token` do associado, montando o
 * link da página pública de pagamento.
 *
 * ⚠️ Não há credencial Meta configurada no ambiente. A impl HTTP está pronta,
 * mas a API real NUNCA é chamada na suíte de testes (mockada via DI token).
 */

export interface SendTemplateInput {
  /** Destinatário em E.164 (ex.: +5562999998888). */
  toE164: string;
  /** Nome do template aprovado na Meta (ex.: `cobranca_associado`). */
  templateName: string;
  /**
   * Variáveis de corpo do template, na ordem (`{{1}}`, `{{2}}`, ...).
   * Ex.: `[nomeDoAssociado, valorSugerido]`.
   */
  variables: string[];
  /**
   * Parâmetro do botão de URL dinâmica do template — aqui é o `payment_token`,
   * que o cliente concatena à `APP_ASSOCIADOS_URL` para montar o link final
   * (`APP_ASSOCIADOS_URL/p/:payment_token`).
   */
  urlButtonParam: string;
}

export interface SendTemplateResult {
  /** true quando a Meta aceitou a mensagem; false em best-effort (falha logada). */
  sent: boolean;
  /** Id da mensagem retornado pela Meta, quando disponível. */
  messageId: string | null;
}

/**
 * Interface do cliente WhatsApp. O resto do módulo depende SÓ desta interface —
 * a impl HTTP fica encapsulada e é trocada por mock nos testes.
 */
export interface WhatsAppClient {
  sendTemplate(input: SendTemplateInput): Promise<SendTemplateResult>;
}

/** Token de injeção do cliente (permite trocar a impl por mock nos testes). */
export const WHATSAPP_CLIENT = Symbol('WHATSAPP_CLIENT');
