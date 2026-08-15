/**
 * Story 178 — motor de variáveis de documento, desacoplado de `Resident`.
 *
 * Até aqui `applyVariables(content, resident, responsible, signer, photo)` era
 * uma função com `Resident` na assinatura, e por isso um recibo (que não tem
 * filho nenhum) não tinha onde nascer. O contrato abaixo separa QUEM sabe montar
 * o dicionário de tokens (o resolver, um por assunto: filho, contribuição,
 * pizza…) de COMO os tokens entram no HTML (esta mecânica, compartilhada).
 *
 * A renderização — `wrapPage`, margem A4, puppeteer — segue no
 * `DocumentTemplateService`: o que muda entre um documento de filho e um recibo
 * é o dicionário, não a impressora.
 */

/** Dicionário de tokens de um documento já resolvido. */
export interface DocumentVariables {
  /** `{{token}}` → texto puro. */
  text: Record<string, string>;
  /**
   * `{{token}}` → HTML de BLOCO (assinatura, foto). Recebe o `text-align` do
   * parágrafo que continha só o token, quando houver (story 136).
   */
  blocks: Record<string, (align?: string) => string>;
}

/** Quem sabe montar o dicionário de um assunto (filho, contribuição, …). */
export interface DocumentVariableResolver {
  resolve(): Promise<DocumentVariables>;
}

// Ruído que o editor deixa em volta do token dentro do <p>: espaços, `&nbsp;` e
// os <span> de fonte (ex.:
// `<p style="text-align:center"><span …>&nbsp;{{signature}}</span></p>`).
// Sem tolerar isso, o parágrafo não casa e o bloco cai no fallback inline sem
// alinhamento (bug de produção da story 136).
const TOKEN_WRAP = String.raw`(?:\s|&nbsp;|<span[^>]*>|</span>)*`;

/**
 * Story 136 — extrai o text-align dos atributos de um <p> que só contém o token
 * de bloco, para que o bloco honre o alinhamento escolhido no editor.
 */
export function extractTextAlign(attrs: string): string | undefined {
  const match = attrs.match(/text-align\s*:\s*(left|right|center|justify)/i);
  return match ? match[1].toLowerCase() : undefined;
}

/**
 * Mecânica das variáveis de BLOCO ({{signature}}, story 128/136;
 * {{residentPhoto}}, story 157). Em ordem:
 *   1. troca o <p …> INTEIRO quando o token é seu único conteúdo visível,
 *      carregando o text-align do parágrafo — evita <div> dentro de <p>
 *      (o parser fecha o <p> e o alinhamento se perde);
 *   2. fallback inline para as ocorrências remanescentes (sem alinhamento).
 * Os dois `replace` usam FUNÇÃO: o `$` de uma URL presignada não pode ser
 * interpretado como padrão de substituição.
 */
export function replaceBlockToken(
  html: string,
  token: string,
  build: (align?: string) => string,
): string {
  const escaped = escapeRegExp(token);
  const result = html.replace(
    new RegExp(`<p([^>]*)>${TOKEN_WRAP}${escaped}${TOKEN_WRAP}</p>`, 'g'),
    (_m, attrs: string) => build(extractTextAlign(attrs)),
  );
  const inlineBlock = build();
  return result.replace(new RegExp(escaped, 'g'), () => inlineBlock);
}

/**
 * Aplica o dicionário ao conteúdo: primeiro os tokens de texto, depois os de
 * bloco (que podem injetar HTML contendo `{{`-nada, mas cuja saída não deve ser
 * varrida de novo pelos tokens de texto).
 *
 * A substituição de texto usa FUNÇÃO pelo mesmo motivo dos blocos: valores de
 * dinheiro (`R$ 1.234,56`) e URLs carregam `$`, que num replace por string
 * viraria padrão de substituição.
 */
export function applyDocumentVariables(content: string, vars: DocumentVariables): string {
  let result = content;
  for (const [key, value] of Object.entries(vars.text)) {
    result = result.replace(new RegExp(`\\{\\{${escapeRegExp(key)}\\}\\}`, 'g'), () => value);
  }
  for (const [token, build] of Object.entries(vars.blocks)) {
    result = replaceBlockToken(result, token, build);
  }
  return result;
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Formatadores compartilhados ──────────────────────────────────────────────
// Movidos do DocumentTemplateService sem alteração de saída: os documentos de
// filho continuam imprimindo exatamente o que imprimiam.

export function formatDate(date: Date | string | null): string {
  if (!date) return '___/___/______';
  return new Date(date).toLocaleDateString('pt-BR', { timeZone: 'UTC' });
}

export function formatDateLong(date: Date | string | null): string {
  if (!date) return '_______________';
  return new Date(date).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatCpf(cpf: string | null): string {
  if (!cpf) return 'não informado';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

export function computeAge(birthDate: Date | string | null): string {
  if (!birthDate) return 'não informado';
  const birth = new Date(birthDate);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return `${age} anos`;
}

export function slugify(text: string): string {
  return text
    .normalize('NFD')
    .split('')
    .filter((c) => c.charCodeAt(0) < 0x0300 || c.charCodeAt(0) > 0x036f)
    .join('')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Valor em reais no formato brasileiro (`R$ 1.234,56`). */
export function formatBRL(amount: number): string {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(amount);
}

// ─── Blocos compartilhados ────────────────────────────────────────────────────

/** Quem assina o documento: nome + URL da assinatura JÁ resolvida/assinada. */
export interface DocumentSigner {
  name: string;
  signatureUrl: string | null;
}

/**
 * Bloco da assinatura (story 128): imagem acima da linha (25 "_") e nome abaixo.
 * Sem imagem, sai só a linha + nome — o documento nunca imprime {{signature}}
 * cru. Story 137: a role deixou de ser impressa e o nome não é mais negrito.
 * Vale nos DOIS mundos (story 178): recibo também é assinado por quem emitiu.
 */
export function buildSignatureBlock(signer: DocumentSigner | null, align?: string): string {
  const line = '_'.repeat(25);
  const img = signer?.signatureUrl
    ? `<img class="doc-signature-img" src="${signer.signatureUrl}" alt="Assinatura"/>`
    : '';
  const name = signer?.name ? `<div class="doc-signature-name">${signer.name}</div>` : '';
  // Story 136 — alinhamento do parágrafo carregado para o style do bloco.
  const style = align ? ` style="text-align:${align}"` : '';
  return `<div class="doc-signature"${style}>${img}<div class="doc-signature-line">${line}</div>${name}</div>`;
}
