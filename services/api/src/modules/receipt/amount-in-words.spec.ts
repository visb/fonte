import { amountInWords, integerInWords } from './amount-in-words';

// Story 178 — o valor por extenso é exatamente o tipo de código que erra em
// centavos, no singular e no milhão; daí a spec dedicada.

describe('integerInWords', () => {
  it.each([
    [0, 'zero'],
    [1, 'um'],
    [15, 'quinze'],
    [20, 'vinte'],
    [21, 'vinte e um'],
    [100, 'cem'],
    [101, 'cento e um'],
    [120, 'cento e vinte'],
    [121, 'cento e vinte e um'],
    [200, 'duzentos'],
    [999, 'novecentos e noventa e nove'],
    [1000, 'mil'],
    [1050, 'mil e cinquenta'],
    [1200, 'mil e duzentos'],
    [1234, 'mil duzentos e trinta e quatro'],
    [2000, 'dois mil'],
    [1000000, 'um milhão'],
    [2000000, 'dois milhões'],
  ])('%i → %s', (n, expected) => {
    expect(integerInWords(n)).toBe(expected);
  });
});

describe('amountInWords', () => {
  it('zero sai "zero reais" (forma usada em documento, não "zero real")', () => {
    expect(amountInWords(0)).toBe('zero reais');
  });

  it('só centavos: 0,01 → um centavo (singular), sem parte de reais', () => {
    expect(amountInWords(0.01)).toBe('um centavo');
    expect(amountInWords(0.9)).toBe('noventa centavos');
  });

  it('singular do real: 1,00 → um real', () => {
    expect(amountInWords(1)).toBe('um real');
  });

  it('1,01 junta o singular dos dois lados', () => {
    expect(amountInWords(1.01)).toBe('um real e um centavo');
  });

  it('valor típico de contribuição: 50,00', () => {
    expect(amountInWords(50)).toBe('cinquenta reais');
  });

  it('reais e centavos juntos: 1.234,56', () => {
    expect(amountInWords(1234.56)).toBe(
      'mil duzentos e trinta e quatro reais e cinquenta e seis centavos',
    );
  });

  it('milhão redondo pede a preposição: "um milhão de reais"', () => {
    expect(amountInWords(1000000)).toBe('um milhão de reais');
  });

  it('milhão com parcela menor NÃO leva "de"', () => {
    expect(amountInWords(1000050)).toBe('um milhão e cinquenta reais');
  });

  // Ponto flutuante: 1.1 * 100 = 110.00000000000001. O arredondamento em
  // centavos ANTES da decomposição é o que evita imprimir "nove centavos".
  it('arredonda em centavos antes de decompor (regressão de ponto flutuante)', () => {
    expect(amountInWords(1.1)).toBe('um real e dez centavos');
    expect(amountInWords(2.675)).toBe('dois reais e sessenta e oito centavos');
  });

  it('valor negativo ou inválido não quebra o recibo', () => {
    expect(amountInWords(-50)).toBe('cinquenta reais');
    expect(amountInWords(Number.NaN)).toBe('zero reais');
  });
});
