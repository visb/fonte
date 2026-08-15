/**
 * Story 178 — valor por extenso em pt-BR, para o `{{amountInWords}}` do recibo.
 *
 * Função própria e não pacote: é uma função (não vale uma dependência nova) e é
 * exatamente o tipo de código que erra em centavos, no singular (`um real`) e no
 * milhão — por isso tem spec dedicada.
 *
 * Regras da língua embutidas aqui:
 * - `cento` vira `cem` quando é exatamente 100 (`cem reais`, não `cento reais`);
 * - `e` liga a última parcela dentro de cada grupo de três (`cento e vinte e um`);
 * - o `e` entre milhar e centena só entra quando a centena é < 100 ou múltiplo
 *   exato de 100 (`mil e cinquenta`, `mil e duzentos`, mas `mil duzentos e um`);
 * - `um mil` não existe: é `mil`.
 */

const UNITS = [
  '',
  'um',
  'dois',
  'três',
  'quatro',
  'cinco',
  'seis',
  'sete',
  'oito',
  'nove',
  'dez',
  'onze',
  'doze',
  'treze',
  'quatorze',
  'quinze',
  'dezesseis',
  'dezessete',
  'dezoito',
  'dezenove',
];

const TENS = [
  '',
  '',
  'vinte',
  'trinta',
  'quarenta',
  'cinquenta',
  'sessenta',
  'setenta',
  'oitenta',
  'noventa',
];

const HUNDREDS = [
  '',
  'cento',
  'duzentos',
  'trezentos',
  'quatrocentos',
  'quinhentos',
  'seiscentos',
  'setecentos',
  'oitocentos',
  'novecentos',
];

// Escalas em grupos de três, na forma [singular, plural].
const SCALES: [string, string][] = [
  ['', ''],
  ['mil', 'mil'],
  ['milhão', 'milhões'],
  ['bilhão', 'bilhões'],
];

/** 1..999 por extenso. */
function spellGroup(n: number): string {
  if (n === 100) return 'cem';
  const parts: string[] = [];
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  if (hundreds) parts.push(HUNDREDS[hundreds]);
  if (rest) {
    if (rest < 20) parts.push(UNITS[rest]);
    else {
      const tens = Math.floor(rest / 10);
      const unit = rest % 10;
      parts.push(unit ? `${TENS[tens]} e ${UNITS[unit]}` : TENS[tens]);
    }
  }
  return parts.join(' e ');
}

/** Inteiro não negativo por extenso (sem unidade monetária). */
export function integerInWords(value: number): string {
  if (value === 0) return 'zero';
  const groups: number[] = [];
  let rest = Math.floor(value);
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }
  const spelled: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const group = groups[i];
    if (!group) continue;
    const [singular, plural] = SCALES[i] ?? ['', ''];
    // `um mil` não existe em pt-BR.
    const words = i === 1 && group === 1 ? '' : spellGroup(group);
    const scale = i === 0 ? '' : group === 1 ? singular : plural;
    spelled.push([words, scale].filter(Boolean).join(' '));
  }
  // O `e` final só entra quando a última parcela é "pequena" (< 100) ou centena
  // redonda: `mil e cinquenta`, `mil e duzentos`, mas `mil duzentos e um`.
  const last = groups[0];
  const hasMoreThanOneGroup = spelled.length > 1;
  if (hasMoreThanOneGroup && last && (last < 100 || last % 100 === 0)) {
    const tail = spelled.pop() as string;
    return `${spelled.join(', ')} e ${tail}`;
  }
  return spelled.join(' ');
}

/**
 * Valor em reais por extenso: `1234.56` → `mil duzentos e trinta e quatro reais
 * e cinquenta e seis centavos`.
 *
 * `0` → `zero reais` (e não `zero real`): é a forma usada em documento.
 * Só centavos → `um centavo` / `noventa centavos`, sem a parte de reais.
 */
export function amountInWords(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.abs(amount) : 0;
  // Arredondamento em CENTAVOS antes de qualquer decomposição: `Math.round` no
  // total evita o clássico `1.10 * 100 = 110.00000000000001` virar 109 centavos.
  const totalCents = Math.round(safe * 100);
  const reais = Math.floor(totalCents / 100);
  const cents = totalCents % 100;

  // `um milhão de reais`, e não `um milhão reais`: em pt-BR a escala isolada
  // pede a preposição. Só vale quando NÃO sobra parcela menor
  // (`um milhão e quinhentos mil reais` fica sem o `de`).
  const spelledReais = integerInWords(reais);
  const needsDe = /\b(milhão|milhões|bilhão|bilhões)$/.test(spelledReais);
  const reaisPart =
    reais === 1 ? 'um real' : `${spelledReais}${needsDe ? ' de' : ''} reais`;
  const centsPart = cents === 1 ? 'um centavo' : `${integerInWords(cents)} centavos`;

  if (!cents) return reaisPart;
  if (!reais) return centsPart;
  return `${reaisPart} e ${centsPart}`;
}
