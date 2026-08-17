import { ReceivableStatus } from '@fonte/types';
import type { ResidentReceivableSummary } from '@fonte/api-client';
import { formatReferenceMonth, currentReceivable } from './receivables';

// Story 186 — a fixture é o RECORTE (três campos), não o carnê. Os casos abaixo
// continuam com as mesmas expectativas: é a prova de que a escolha da parcela
// nunca dependeu de valor ou pagamento.
function makeReceivable(
  overrides: Partial<ResidentReceivableSummary> = {},
): ResidentReceivableSummary {
  return {
    id: 'rc-1',
    referenceMonth: '2026-01-01',
    status: ReceivableStatus.PENDING,
    ...overrides,
  };
}

describe('formatReferenceMonth', () => {
  it('formata YYYY-MM-DD para Mês/Ano em pt-BR', () => {
    expect(formatReferenceMonth('2026-06-01')).toBe('Junho/2026');
    expect(formatReferenceMonth('2026-12-01')).toBe('Dezembro/2026');
  });
});

describe('currentReceivable', () => {
  it('retorna null quando não há parcelas', () => {
    expect(currentReceivable([])).toBeNull();
  });

  it('retorna null quando só há parcelas canceladas', () => {
    expect(
      currentReceivable([makeReceivable({ status: ReceivableStatus.CANCELED })]),
    ).toBeNull();
  });

  it('prefere a parcela do mês de referência atual', () => {
    const currentMonth = new Date().toISOString().slice(0, 7);
    const target = makeReceivable({ id: 'now', referenceMonth: `${currentMonth}-01` });
    const other = makeReceivable({ id: 'old', referenceMonth: '2020-01-01' });
    expect(currentReceivable([other, target])?.id).toBe('now');
  });

  it('sem parcela do mês atual, pega a PENDENTE mais recente', () => {
    const older = makeReceivable({
      id: 'old',
      referenceMonth: '2020-01-01',
      status: ReceivableStatus.PENDING,
    });
    const newer = makeReceivable({
      id: 'new',
      referenceMonth: '2020-05-01',
      status: ReceivableStatus.PENDING,
    });
    const paid = makeReceivable({
      id: 'paid',
      referenceMonth: '2020-09-01',
      status: ReceivableStatus.PAID,
    });
    expect(currentReceivable([older, newer, paid])?.id).toBe('new');
  });

  it('sem parcela do mês atual e sem pendentes, pega a mais recente ativa', () => {
    const older = makeReceivable({
      id: 'old',
      referenceMonth: '2020-01-01',
      status: ReceivableStatus.PAID,
    });
    const newer = makeReceivable({
      id: 'new',
      referenceMonth: '2020-05-01',
      status: ReceivableStatus.PAID,
    });
    expect(currentReceivable([older, newer])?.id).toBe('new');
  });
});
