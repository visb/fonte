import { ChargeStatus } from '@fonte/types';
import { Associate } from '../associate/associate.entity';
import { AssociateCharge } from '../associate/associate-charge.entity';
import {
  AssociateContributionReceiptResolver,
  formatReceiptNumber,
  referenceMonthOf,
} from './associate-contribution-receipt.resolver';

function makeCharge(overrides: Partial<AssociateCharge> = {}): AssociateCharge {
  return {
    id: 'chg-1',
    associateId: 'asc-1',
    grossAmount: 51.75,
    netAmount: 50,
    feeAmount: 1.75,
    status: ChargeStatus.PAID,
    dueDate: '2026-08-10',
    paidAt: new Date('2026-08-09T12:00:00.000Z'),
    ...overrides,
  } as AssociateCharge;
}

const ASSOCIATE = { id: 'asc-1', name: 'Maria Souza' } as Associate;

describe('formatReceiptNumber', () => {
  it('zero-padded a 6 — é o número do livro, tem que ficar estável na página', () => {
    expect(formatReceiptNumber(1)).toBe('000001');
    expect(formatReceiptNumber(123)).toBe('000123');
    expect(formatReceiptNumber(1234567)).toBe('1234567');
  });
});

describe('referenceMonthOf', () => {
  it('lê a competência da string date, sem passar por Date local', () => {
    expect(referenceMonthOf('2026-08-10')).toBe('agosto/2026');
    // Dia 1º é o caso que um `new Date('2026-03-01')` em fuso negativo puxaria
    // para fevereiro, imprimindo a competência errada.
    expect(referenceMonthOf('2026-03-01')).toBe('março/2026');
  });

  it('sem vencimento → "não informado", nunca "Invalid Date"', () => {
    expect(referenceMonthOf(null)).toBe('não informado');
    expect(referenceMonthOf('2026-99-01')).toBe('não informado');
  });
});

describe('AssociateContributionReceiptResolver', () => {
  it('preenche todos os tokens da tabela do plano a partir de charge + associate', async () => {
    const resolver = new AssociateContributionReceiptResolver({
      charge: makeCharge(),
      associate: ASSOCIATE,
      number: 123,
      signer: null,
    });
    const { text } = await resolver.resolve();

    expect(text.receiptNumber).toBe('000123');
    expect(text.payerName).toBe('Maria Souza');
    expect(text.payerCpf).toBe('não informado');
    // O que o associado PAGOU é o bruto — não o líquido que entra na conta.
    expect(text.amount).toContain('51,75');
    expect(text.netAmount).toContain('50,00');
    expect(text.feeAmount).toContain('1,75');
    expect(text.amountInWords).toBe('cinquenta e um reais e setenta e cinco centavos');
    expect(text.referenceMonth).toBe('agosto/2026');
    expect(text.paymentDate).toBe('09/08/2026');
    expect(text.dueDate).toBe('10/08/2026');
    expect(text.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(text.dateLong).toContain('de');
  });

  it('formata o CPF do pagador quando existir', async () => {
    const resolver = new AssociateContributionReceiptResolver({
      charge: makeCharge(),
      associate: { ...ASSOCIATE, cpf: '12345678901' } as Associate & { cpf: string },
      number: 1,
      signer: null,
    });
    const { text } = await resolver.resolve();
    expect(text.payerCpf).toBe('123.456.789-01');
  });

  it('{{signature}} é bloco: sai o HTML da assinatura de quem emitiu, nunca o token cru', async () => {
    const resolver = new AssociateContributionReceiptResolver({
      charge: makeCharge(),
      associate: ASSOCIATE,
      number: 1,
      signer: { name: 'Ana Coordenadora', signatureUrl: 'https://s3/sig.png' },
    });
    const { blocks } = await resolver.resolve();
    const html = blocks['{{signature}}']('center');
    expect(html).toContain('doc-signature');
    expect(html).toContain('Ana Coordenadora');
    expect(html).toContain('text-align:center');
  });

  it('não imprime nenhum token de filho — recibo não tem acolhido', async () => {
    const resolver = new AssociateContributionReceiptResolver({
      charge: makeCharge(),
      associate: ASSOCIATE,
      number: 1,
      signer: null,
    });
    const { text, blocks } = await resolver.resolve();
    expect(text.name).toBeUndefined();
    expect(text.entryDate).toBeUndefined();
    expect(blocks['{{residentPhoto}}']).toBeUndefined();
  });
});
