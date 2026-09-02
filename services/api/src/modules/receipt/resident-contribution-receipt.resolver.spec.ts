import { FamilyInvestment, PaymentMethod, ReceivableStatus } from '@fonte/types';
import { Relative } from '../relative/relative.entity';
import { Resident } from '../resident/resident.entity';
import { ResidentReceivable } from '../resident-receivable/resident-receivable.entity';
import { ResidentContributionReceiptResolver } from './resident-contribution-receipt.resolver';

function makeReceivable(overrides: Partial<ResidentReceivable> = {}): ResidentReceivable {
  return {
    id: 'rcv-1',
    residentId: 'res-1',
    admissionId: 'adm-1',
    referenceMonth: '2026-08-01',
    dueDate: '2026-08-10',
    amount: 500,
    familyInvestment: FamilyInvestment.BASKET_500,
    paidAmount: 480,
    paidFamilyInvestment: null,
    mandatory: true,
    status: ReceivableStatus.PAID,
    paidAt: '2026-08-09',
    paymentMethod: PaymentMethod.PIX,
    ...overrides,
  } as unknown as ResidentReceivable;
}

const RESIDENT = { id: 'res-1', name: 'Pedro Acolhido', cpf: '12345678901' } as Resident;

const RESPONSIBLE = {
  id: 'rel-1',
  name: 'Maria Mãe',
  relationship: 'Mãe',
  residentId: 'res-1',
} as Relative;

function resolve(input: Partial<Parameters<typeof buildResolver>[0]> = {}) {
  return buildResolver(input).resolve();
}

function buildResolver(input: {
  receivable?: ResidentReceivable;
  resident?: Resident;
  responsible?: Relative | null;
  houseName?: string;
  number?: number;
  signer?: { name: string; signatureUrl: string | null } | null;
}) {
  return new ResidentContributionReceiptResolver({
    receivable: input.receivable ?? makeReceivable(),
    resident: input.resident ?? RESIDENT,
    responsible: input.responsible === undefined ? RESPONSIBLE : input.responsible,
    houseName: input.houseName ?? 'Casa Betel',
    number: input.number ?? 123,
    signer: input.signer ?? null,
  });
}

describe('ResidentContributionReceiptResolver — tokens do plano (story 193)', () => {
  it('preenche todos os tokens da tabela a partir da parcela, do filho e do responsável', async () => {
    const { text } = await resolve();

    expect(text.receiptNumber).toBe('000123');
    expect(text.payerName).toBe('Maria Mãe');
    expect(text.payerRelationship).toBe('Mãe');
    expect(text.residentName).toBe('Pedro Acolhido');
    expect(text.residentCpf).toBe('123.456.789-01');
    expect(text.houseName).toBe('Casa Betel');
    expect(text.amount).toContain('480,00');
    expect(text.amountInWords).toBe('quatrocentos e oitenta reais');
    expect(text.referenceMonth).toBe('agosto/2026');
    expect(text.paymentDate).toBe('09/08/2026');
    expect(text.dueDate).toBe('10/08/2026');
    expect(text.paymentMethod).toBe('PIX');
    expect(text.contributionPlan).toBe('R$ 500 + cestas');
    expect(text.date).toMatch(/^\d{2}\/\d{2}\/\d{4}$/);
    expect(text.dateLong).toContain('de');
  });

  // Decisão 6 — o recibo é do dinheiro que ENTROU, não do que o plano previa.
  it('{{amount}} usa paidAmount quando presente e cai para amount quando nulo', async () => {
    const pago = await resolve({ receivable: makeReceivable({ paidAmount: 480 }) });
    expect(pago.text.amount).toContain('480,00');
    expect(pago.text.amountInWords).toBe('quatrocentos e oitenta reais');

    const semPago = await resolve({ receivable: makeReceivable({ paidAmount: null }) });
    expect(semPago.text.amount).toContain('500,00');
    expect(semPago.text.amountInWords).toBe('quinhentos reais');
  });

  // Decisão 7 — a competência tem coluna própria. Vencimento em setembro com
  // competência de agosto é o caso que separa os dois de vez.
  it('{{referenceMonth}} sai da competência, NUNCA do vencimento', async () => {
    const { text } = await resolve({
      receivable: makeReceivable({
        referenceMonth: '2026-08-01' as never,
        dueDate: '2026-09-10' as never,
      }),
    });
    expect(text.referenceMonth).toBe('agosto/2026');
    expect(text.dueDate).toBe('10/09/2026');
  });

  it('competência de dia 1º não escorrega de mês (fuso negativo)', async () => {
    const { text } = await resolve({
      receivable: makeReceivable({ referenceMonth: '2026-03-01' as never }),
    });
    expect(text.referenceMonth).toBe('março/2026');
  });

  it('{{paymentMethod}} fica vazio com método nulo (nada de "null" impresso)', async () => {
    const { text } = await resolve({ receivable: makeReceivable({ paymentMethod: null }) });
    expect(text.paymentMethod).toBe('');
  });

  it('{{paymentMethod}} usa o rótulo compartilhado do @fonte/types', async () => {
    const { text } = await resolve({
      receivable: makeReceivable({ paymentMethod: PaymentMethod.BASKET }),
    });
    expect(text.paymentMethod).toBe('Cesta');
  });

  it('{{contributionPlan}} prefere a modalidade efetivamente paga', async () => {
    const { text } = await resolve({
      receivable: makeReceivable({
        familyInvestment: FamilyInvestment.BASKET_500,
        paidFamilyInvestment: FamilyInvestment.PAYMENT_700,
      }),
    });
    expect(text.contributionPlan).toBe('R$ 700');
  });

  it('não oferece netAmount/feeAmount — não há gateway no carnê do filho', async () => {
    const { text } = await resolve();
    expect(text.netAmount).toBeUndefined();
    expect(text.feeAmount).toBeUndefined();
  });

  it('{{signature}} é bloco: HTML da assinatura de quem emitiu, nunca o token cru', async () => {
    const { blocks } = await resolve({
      signer: { name: 'Ana Coordenadora', signatureUrl: 'https://s3/sig.png' },
    });
    const html = blocks['{{signature}}']('center');
    expect(html).toContain('doc-signature');
    expect(html).toContain('Ana Coordenadora');
    expect(html).toContain('text-align:center');
  });
});

// ─── Pagador (decisão 9) ──────────────────────────────────────────────────────

describe('ResidentContributionReceiptResolver — pagador (decisão 9)', () => {
  it('com responsável, o pagador é ELE — e o acolhido segue em token próprio', async () => {
    const { text } = await resolve();
    expect(text.payerName).toBe('Maria Mãe');
    expect(text.residentName).toBe('Pedro Acolhido');
    expect(text.payerName).not.toBe(text.residentName);
  });

  it('sem responsável, o pagador cai para o nome do filho, CPF vazio e SEM exceção', async () => {
    const { text } = await resolve({ responsible: null });
    expect(text.payerName).toBe('Pedro Acolhido');
    expect(text.payerCpf).toBe('');
    expect(text.payerRelationship).toBe('');
  });

  it('filho sem casa (ARCHIVED) imprime {{houseName}} vazio, sem quebrar', async () => {
    const { text } = await resolve({ houseName: '' });
    expect(text.houseName).toBe('');
    expect(text.residentName).toBe('Pedro Acolhido');
  });

  // Dado legado do import em lote: parcela sem modalidade e filho sem nome
  // existem no banco. O recibo de dinheiro já recebido não pode quebrar por
  // isso — imprime vazio e segue.
  it('parcela sem modalidade e filho sem nome não quebram a emissão', async () => {
    const { text } = await resolve({
      receivable: makeReceivable({
        familyInvestment: null as never,
        paidFamilyInvestment: null,
      }),
      resident: { id: 'res-1', name: null, cpf: null } as unknown as Resident,
      responsible: null,
    });
    expect(text.contributionPlan).toBe('');
    expect(text.residentName).toBe('');
    expect(text.payerName).toBe('');
  });

  it('filho sem CPF cadastrado não imprime "undefined"', async () => {
    const { text } = await resolve({
      resident: { id: 'res-1', name: 'Pedro Acolhido', cpf: null } as Resident,
    });
    expect(text.residentCpf).toBe('não informado');
  });
});
