import {
  diffSnapshots,
  maskAuditValue,
  maskLoginIdentifier,
  normalizeAuditValue,
} from './audit-diff';
import {
  RESIDENT_AUDIT_FIELDS,
  STAFF_AUDIT_FIELDS,
  RECEIVABLE_AUDIT_FIELDS,
} from './audit-fields';

describe('normalizeAuditValue', () => {
  it('normaliza vazios, datas e objetos', () => {
    expect(normalizeAuditValue(undefined)).toBeNull();
    expect(normalizeAuditValue('')).toBeNull();
    expect(normalizeAuditValue(new Date('2024-01-01T00:00:00.000Z'))).toBe('2024-01-01');
    expect(normalizeAuditValue(new Date('2024-01-01T10:00:00.000Z'))).toBe('2024-01-01T10:00:00.000Z');
    expect(normalizeAuditValue(new Date('x'))).toBeNull();
    expect(normalizeAuditValue({ a: 1 })).toEqual({ a: 1 });
    expect(normalizeAuditValue(3)).toBe(3);
  });
});

describe('máscaras', () => {
  it('maskAuditValue: e-mail, documento e valores curtos', () => {
    expect(maskAuditValue('ana@fonte.com')).toBe('a***@fonte.com');
    expect(maskAuditValue('123.456.789-00')).toBe('***00');
    expect(maskAuditValue('12')).toBe('***');
    expect(maskAuditValue('  ')).toBeNull();
    expect(maskAuditValue(null)).toBeNull();
  });

  it('maskLoginIdentifier: telefone só com 4 dígitos finais; tipos inválidos → null', () => {
    expect(maskLoginIdentifier('(11) 98765-4321')).toBe('***4321');
    expect(maskLoginIdentifier('123')).toBe('***');
    expect(maskLoginIdentifier('maria@fonte.com')).toBe('m***@fonte.com');
    expect(maskLoginIdentifier('')).toBeNull();
    expect(maskLoginIdentifier(42)).toBeNull();
  });
});

describe('diffSnapshots', () => {
  it('sem estado nenhum → vazio', () => {
    expect(diffSnapshots(RESIDENT_AUDIT_FIELDS, null, null)).toEqual([]);
  });

  it('campo sensível alterado continua sinalizado mesmo com máscara igual', () => {
    const changes = diffSnapshots(
      RESIDENT_AUDIT_FIELDS,
      { cpf: '111.111.111-00' },
      { cpf: '222.222.222-00' },
    );
    expect(changes).toEqual([{ field: 'cpf', before: '***00', after: '***00', redacted: true }]);
  });

  it('dado de saúde nunca entra em texto; arquivo vira marcador', () => {
    const changes = diffSnapshots(
      RESIDENT_AUDIT_FIELDS,
      { healthIssues: 'diabetes', photoUrl: null },
      { healthIssues: 'hipertensão', photoUrl: 'https://bucket/residents/a.jpg?X-Amz-Signature=1' },
    );
    expect(changes).toEqual([
      { field: 'healthIssues', before: null, after: null, redacted: true },
      { field: 'photoUrl', before: null, after: '[arquivo]', redacted: false },
    ]);
    expect(JSON.stringify(changes)).not.toMatch(/diabetes|bucket|Signature/);
  });

  it('campo fora da lista (hash, token) nunca entra no log', () => {
    const changes = diffSnapshots(
      STAFF_AUDIT_FIELDS,
      { name: 'A', passwordHash: 'h1' },
      { name: 'B', passwordHash: 'h2' },
    );
    expect(changes.map((c) => c.field)).toEqual(['name']);
  });

  it('observações da parcela são texto livre: só sinaliza', () => {
    const changes = diffSnapshots(RECEIVABLE_AUDIT_FIELDS, { notes: null }, { notes: 'pagou o João' });
    expect(changes).toEqual([{ field: 'notes', before: null, after: null, redacted: true }]);
  });
});
