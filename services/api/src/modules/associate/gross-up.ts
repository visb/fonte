/**
 * Gross-up das taxas de cartão (story 38).
 *
 * O associado escolhe quanto quer *contribuir* (líquido `net` para a Fonte). O
 * valor cobrado no cartão (`gross`) precisa cobrir as taxas do gateway para que a
 * Fonte receba o valor cheio:
 *
 *   gross = round2( (net + f) / (1 - p) )
 *   fee   = gross - net
 *
 * onde `p` é a taxa percentual (ex.: 0.035 = 3,5%) e `f` a taxa fixa (ex.: 0.60).
 * Função pura, sem dependências — 100% testável.
 */
export interface GrossUp {
  net: number;
  fee: number;
  gross: number;
}

/** Arredonda para 2 casas decimais evitando erro de ponto flutuante. */
function round2(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

export function computeGrossUp(net: number, p: number, f: number): GrossUp {
  if (!Number.isFinite(net) || net <= 0) {
    throw new Error('net must be a positive finite number');
  }
  if (!Number.isFinite(p) || p < 0 || p >= 1) {
    throw new Error('fee percentage (p) must be in [0, 1)');
  }
  if (!Number.isFinite(f) || f < 0) {
    throw new Error('fixed fee (f) must be a non-negative finite number');
  }

  const gross = round2((net + f) / (1 - p));
  const fee = round2(gross - net);
  return { net: round2(net), fee, gross };
}
