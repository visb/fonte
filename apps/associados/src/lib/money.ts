export function formatBRL(value: number): string {
  return value.toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  });
}

const FEE_PCT = Number(import.meta.env.VITE_ABACATEPAY_CARD_FEE_PCT ?? '0');
const FEE_FIXED = Number(import.meta.env.VITE_ABACATEPAY_CARD_FEE_FIXED ?? '0');

/**
 * Espelha o cálculo de gross-up do backend ([[38]]) para PREVIEW na tela:
 *   gross = round2( (net + f) / (1 - p) )
 *   fee   = gross - net
 * O valor cobrado oficial é o que o backend retorna no subscribe; aqui é só para
 * mostrar de forma transparente quanto será debitado no cartão antes de submeter.
 */
export function previewGrossUp(net: number): {
  net: number;
  fee: number;
  gross: number;
} {
  if (!Number.isFinite(net) || net <= 0 || FEE_PCT >= 1) {
    return { net: Math.max(0, net || 0), fee: 0, gross: Math.max(0, net || 0) };
  }
  const gross = Math.round(((net + FEE_FIXED) / (1 - FEE_PCT)) * 100) / 100;
  return { net, fee: Math.round((gross - net) * 100) / 100, gross };
}
