import { filenameSlug, residentReceiptFilename } from '@fonte/types';

// Story 212, decisão 6 — helper único (`@fonte/types`) usado pelo servidor, pelo
// adm e pelo app.fonte. `packages/types` não tem runner próprio: o contrato é
// travado aqui, junto do consumidor do servidor.
describe('residentReceiptFilename (story 212)', () => {
  it('nome + competência → recibo-{slug}-{MM}-{AAAA}.pdf', () => {
    expect(residentReceiptFilename('João da Silva', '2026-10-01')).toBe(
      'recibo-joao-da-silva-10-2026.pdf',
    );
  });

  it('tira acento e cedilha', () => {
    expect(residentReceiptFilename('Conceição Araújo', '2026-03-01')).toBe(
      'recibo-conceicao-araujo-03-2026.pdf',
    );
  });

  it('espaços múltiplos e pontuação viram um hífen só, sem hífen nas pontas', () => {
    expect(residentReceiptFilename('  José   d’Ávila, Jr.  ', '2026-12-01')).toBe(
      'recibo-jose-d-avila-jr-12-2026.pdf',
    );
  });

  it('mês de 1 dígito ganha zero à esquerda', () => {
    expect(residentReceiptFilename('Ana', '2026-1-01')).toBe('recibo-ana-01-2026.pdf');
  });

  it('aceita Date (coluna date) usando a data UTC', () => {
    expect(residentReceiptFilename('Ana', new Date('2026-08-01T00:00:00Z'))).toBe(
      'recibo-ana-08-2026.pdf',
    );
  });

  it('nome vazio → recibo-10-2026.pdf, sem hífen duplo', () => {
    expect(residentReceiptFilename('', '2026-10-01')).toBe('recibo-10-2026.pdf');
    expect(residentReceiptFilename(null, '2026-10-01')).toBe('recibo-10-2026.pdf');
  });

  it('competência ausente ou inválida some do nome', () => {
    expect(residentReceiptFilename('Ana', null)).toBe('recibo-ana.pdf');
    expect(residentReceiptFilename('Ana', 'sem-data')).toBe('recibo-ana.pdf');
    expect(residentReceiptFilename('Ana', new Date('x'))).toBe('recibo-ana.pdf');
    expect(residentReceiptFilename(undefined, undefined)).toBe('recibo.pdf');
  });
});

describe('filenameSlug (story 212)', () => {
  it('minúsculas, sem acento, só [a-z0-9-]', () => {
    expect(filenameSlug('ÁÉÍ Õ ç 123!')).toBe('aei-o-c-123');
    expect(filenameSlug(undefined)).toBe('');
  });
});
