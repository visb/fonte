import { createTokenPlaceholder } from './tokenPlaceholder';

// ─── ResidentPhotoPlaceholder (story 157) ─────────────────────────────────────
// Segunda variável de BLOCO do editor, irmã da assinatura (story 141): o token
// cru `{{residentPhoto}}` ocupa uma linha, mas no PDF vira um quadrado de 151px
// (com a foto do acolhido ou a moldura vazia rotulada "Foto"). Sem a caixa, a
// régua A4 do editor (story 24) mentiria sobre onde a página quebra.
//
// Mesma mecânica da assinatura, vinda da fábrica `createTokenPlaceholder`:
// decoration de VIEW, documento intocado — `editor.getHTML()` continua emitindo
// `{{residentPhoto}}` literal, que é o que o backend substitui.

export const RESIDENT_PHOTO_TOKEN = '{{residentPhoto}}';

// ─── Dimensões fiéis ao bloco do PDF ──────────────────────────────────────────
// Referência: CSS `.doc-photo-img` / `.doc-photo-placeholder` em
// services/api/src/modules/document-template/document-template.service.ts —
//   width:151px;height:151px  (≈ 4 × 4 cm a 96 dpi)
// O bloco não tem margem própria (ao contrário do `.doc-signature{margin-top:24px}`).
// Se o quadrado mudar de tamanho lá, sincronizar aqui.
export const RESIDENT_PHOTO_PLACEHOLDER_SIZE_PX = 151;

const residentPhotoPlaceholder = createTokenPlaceholder({
  token: RESIDENT_PHOTO_TOKEN,
  label: 'Foto do acolhido',
  dataKey: 'resident-photo',
  name: 'residentPhotoPlaceholder',
  widthPx: RESIDENT_PHOTO_PLACEHOLDER_SIZE_PX,
  heightPx: RESIDENT_PHOTO_PLACEHOLDER_SIZE_PX,
  marginTopPx: 0,
  selectTitle: 'Clique para selecionar a variável de foto do acolhido',
  removeTitle: 'Remover foto do acolhido',
});

// Ranges [from, to) do `{{residentPhoto}}` numa string de texto (função pura).
export const findResidentPhotoRanges = residentPhotoPlaceholder.findRanges;

// DecorationSet com a caixa + o token escondido, por ocorrência no doc.
export const buildResidentPhotoDecorations = residentPhotoPlaceholder.buildDecorations;

export const ResidentPhotoPlaceholder = residentPhotoPlaceholder.Extension;
