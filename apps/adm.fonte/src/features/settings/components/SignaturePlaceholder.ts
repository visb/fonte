import { createTokenPlaceholder } from './tokenPlaceholder';

// ─── SignaturePlaceholder (story 141) ─────────────────────────────────────────
// No editor de template a variável de assinatura aparece como o texto cru
// `{{signature}}`. Ao gerar o PDF esse token vira o BLOCO de assinatura (imagem
// ~64px + linha + nome — ver `.doc-signature` em document-template.service.ts),
// que ocupa várias linhas. Como o token cru ocupa só uma linha no editor, a
// paginação da folha A4 (story 24) não casa com a do PDF.
//
// A extensão renderiza — via DECORATION do ProseMirror, SEM alterar o
// documento — uma CAIXA ROTULADA "Assinatura" (retângulo tracejado) por cima de
// cada ocorrência do token, com ALTURA igual ao espaço do bloco no PDF. O texto
// `{{signature}}` literal PERMANECE no doc, então `editor.getHTML()` segue
// emitindo `<p …>{{signature}}</p>` — o que as stories 135/136/137 (detecção do
// parágrafo + substituição do token no backend) exigem. Só a APRESENTAÇÃO muda.
//
// Story 157 — a mecânica virou a fábrica `createTokenPlaceholder`, compartilhada
// com o `{{residentPhoto}}`. Este módulo é a CONFIGURAÇÃO da assinatura e mantém
// os mesmos exports e atributos DOM (`data-signature-placeholder`,
// `data-signature-remove`) de antes: comportamento idêntico.

export const SIGNATURE_TOKEN = '{{signature}}';

// ─── Altura fiel ao bloco do PDF ──────────────────────────────────────────────
// Referência: CSS `.doc-signature` em
// services/api/src/modules/document-template/document-template.service.ts —
//   .doc-signature{margin-top:24px}
//   .doc-signature-img{height:64px}
//   .doc-signature-line + .doc-signature-name  → ~2 linhas de texto @12pt.
// Mantidas aqui como constantes próximas e comentadas: se a assinatura mudar de
// altura no PDF, sincronizar estes valores.
const SIGNATURE_MARGIN_TOP_PX = 24; // .doc-signature{margin-top:24px}
const SIGNATURE_IMG_HEIGHT_PX = 64; // .doc-signature-img{height:64px}
const SIGNATURE_TEXT_LINES_PX = 36; // linha (_____) + nome ≈ 2 linhas @12pt

// Altura da caixa (conteúdo). A margem-topo é aplicada separadamente para
// espelhar o `margin-top:24px` do bloco e preservar a paginação A4 (story 24).
export const SIGNATURE_PLACEHOLDER_HEIGHT_PX =
  SIGNATURE_IMG_HEIGHT_PX + SIGNATURE_TEXT_LINES_PX; // 100

// Largura da caixa. Espelha o `max-width:280px` da imagem da assinatura; como a
// caixa é inline-block, o `text-align` do parágrafo (story 136) a posiciona.
const SIGNATURE_PLACEHOLDER_WIDTH_PX = 260;

const signaturePlaceholder = createTokenPlaceholder({
  token: SIGNATURE_TOKEN,
  label: 'Assinatura',
  dataKey: 'signature',
  name: 'signaturePlaceholder',
  widthPx: SIGNATURE_PLACEHOLDER_WIDTH_PX,
  heightPx: SIGNATURE_PLACEHOLDER_HEIGHT_PX,
  marginTopPx: SIGNATURE_MARGIN_TOP_PX,
  selectTitle: 'Clique para selecionar a variável de assinatura',
  removeTitle: 'Remover assinatura',
});

// Ranges [from, to) do `{{signature}}` numa string de texto (função pura).
export const findSignatureRanges = signaturePlaceholder.findRanges;

// DecorationSet com a caixa + o token escondido, por ocorrência no doc.
export const buildSignatureDecorations = signaturePlaceholder.buildDecorations;

export const SignaturePlaceholder = signaturePlaceholder.Extension;
