import 'reflect-metadata';
import { PATH_METADATA } from '@nestjs/common/constants';
import { Role } from '@fonte/types';
import { ROLES_KEY } from '../../common/decorators/roles.decorator';
import { AUDIT_KEY } from '../../common/decorators/audit.decorator';
import { ResidentController } from './resident.controller';

function residentSvc() {
  return {
    findAll: jest.fn().mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 }),
    findMe: jest.fn().mockResolvedValue({ id: 'me' }),
    uploadPhotoMe: jest.fn().mockResolvedValue({ id: 'me' }),
    getContributionsReport: jest.fn().mockResolvedValue({ items: [] }),
    findOne: jest.fn().mockResolvedValue({ id: 'r1', name: 'Ana' }),
    create: jest.fn().mockResolvedValue({ id: 'r1' }),
    update: jest.fn().mockResolvedValue({ id: 'r1' }),
    updateIdentity: jest.fn().mockResolvedValue({ id: 'r1', cpf: '12345678900' }),
    remove: jest.fn().mockResolvedValue(undefined),
    readmit: jest.fn().mockResolvedValue({ id: 'r1' }),
    findAdmissions: jest.fn().mockResolvedValue([]),
    updateContributionPlan: jest.fn().mockResolvedValue({ id: 'r1' }),
    setContributionExempt: jest.fn().mockResolvedValue({ id: 'r1' }),
    generateAccess: jest.fn().mockResolvedValue({ id: 'r1' }),
    promoteToServant: jest.fn().mockResolvedValue({ id: 's1' }),
    resetPassword: jest.fn().mockResolvedValue(undefined),
    uploadPhoto: jest.fn().mockResolvedValue({ id: 'r1' }),
    findDocuments: jest.fn().mockResolvedValue([]),
    findAdmissionDocuments: jest.fn().mockResolvedValue([]),
    findAttachments: jest.fn().mockResolvedValue([]),
    addAttachment: jest.fn().mockResolvedValue({ id: 'att1' }),
    removeAttachment: jest.fn().mockResolvedValue(undefined),
    uploadSignedDocument: jest.fn().mockResolvedValue({ id: 'doc1' }),
  };
}
const docTpl = {
  renderForResident: jest.fn().mockResolvedValue('<html></html>'),
  generatePdf: jest.fn().mockResolvedValue({ buffer: Buffer.from('pdf'), filename: 'f.pdf' }),
  generateCombinedPdf: jest
    .fn()
    .mockResolvedValue({ buffer: Buffer.from('combined'), filename: 'ana-documentos.pdf' }),
  findAdmissionTemplates: jest.fn().mockResolvedValue([{ id: 't1', name: 'Termo' }]),
};
const followUp = {
  findByResident: jest.fn().mockResolvedValue([]),
  create: jest.fn().mockResolvedValue({ id: 'f1' }),
  bulkCreateContributions: jest.fn().mockResolvedValue({ created: 1, skipped: 0 }),
  uploadAttachment: jest.fn().mockResolvedValue({ id: 'f1' }),
};
const receivable = {
  findByResident: jest.fn().mockResolvedValue([]),
  findSummaryByResident: jest.fn().mockResolvedValue([]),
  registerPayment: jest.fn().mockResolvedValue({ id: 'rcv1' }),
  reopenPayment: jest.fn().mockResolvedValue({ id: 'rcv1' }),
};
const productContribution = {
  listByReceivable: jest.fn().mockResolvedValue([]),
  declare: jest.fn().mockResolvedValue([]),
  remove: jest.fn().mockResolvedValue(undefined),
};
const docxParser = { parseDocx: jest.fn().mockResolvedValue({ resident: {} }) };
const spreadsheetParser = {
  parseSpreadsheet: jest.fn().mockResolvedValue({ rows: [], houses: [], skipped: 0, ignoredSheets: [] }),
};
const importMatch = {
  parseDocxWithSpreadsheet: jest.fn().mockResolvedValue({ matchStatus: 'unmatched' }),
};
const importSvc = {
  checkConflict: jest.fn().mockResolvedValue({ conflicts: [] }),
  commit: jest.fn().mockResolvedValue({ resident: { id: 'r1' }, contributionsCreated: { created: 0, skipped: 0 } }),
};

// Story 193 — emissão do recibo da parcela paga.
const receipts = {
  generateForResidentReceivable: jest.fn().mockResolvedValue({
    buffer: Buffer.from('%PDF-x'),
    filename: 'recibo-contribuicao-acolhido-000001.pdf',
    number: 1,
  }),
};

function make() {
  const rs = residentSvc();
  const c = new ResidentController(
    rs as never,
    docTpl as never,
    followUp as never,
    receivable as never,
    productContribution as never,
    docxParser as never,
    spreadsheetParser as never,
    importMatch as never,
    importSvc as never,
    receipts as never,
  );
  return { c, rs };
}

const user = { userId: 'u1', role: 'ADMIN' } as never;
const file = { buffer: Buffer.from('x'), originalname: 'a.jpg', mimetype: 'image/jpeg' } as Express.Multer.File;

beforeEach(() => jest.clearAllMocks());

describe('ResidentController', () => {
  it('CRUD + me + report delegate', async () => {
    const { c, rs } = make();
    await c.findAll({} as never, user);
    await c.getMe(user);
    await c.uploadPhotoMe(user, file);
    await c.getContributionsReport({ month: '2026-01' } as never);
    await c.findOne('r1');
    await c.create({ name: 'Ana' } as never);
    await c.update('r1', { name: 'B' } as never);
    await c.updateIdentity('r1', { name: 'C', cpf: '12345678900' } as never);
    await c.remove('r1');
    await c.readmit('r1', {} as never);
    await c.getAdmissions('r1');
    expect(rs.findAll).toHaveBeenCalledWith({}, { role: 'ADMIN', userId: 'u1' });
    expect(rs.findMe).toHaveBeenCalledWith('u1');
    expect(rs.create).toHaveBeenCalledWith({ name: 'Ana' });
    expect(rs.updateIdentity).toHaveBeenCalledWith('r1', { name: 'C', cpf: '12345678900' });
    expect(rs.remove).toHaveBeenCalledWith('r1');
  });

  it('parseDocx delegates to the parser', async () => {
    const { c } = make();
    await c.parseDocx(file);
    expect(docxParser.parseDocx).toHaveBeenCalledWith(file.buffer);
  });

  it('parseSpreadsheet delegates to the parser', async () => {
    const { c } = make();
    await c.parseSpreadsheet(file);
    expect(spreadsheetParser.parseSpreadsheet).toHaveBeenCalledWith(file.buffer);
  });

  it('parseDocxWithSpreadsheet parseia as rows e delega', async () => {
    const { c } = make();
    const rows = [{ houseName: 'Casa Um', name: 'Ana', cpf: '1', nameNormalized: 'ana' }];
    await c.parseDocxWithSpreadsheet(file, JSON.stringify(rows));
    expect(importMatch.parseDocxWithSpreadsheet).toHaveBeenCalledWith(file.buffer, rows);
  });

  it('parseDocxWithSpreadsheet rejeita rows malformado', () => {
    const { c } = make();
    expect(() => c.parseDocxWithSpreadsheet(file, 'não-é-json')).toThrow();
    expect(() => c.parseDocxWithSpreadsheet(file, JSON.stringify({ nope: true }))).toThrow();
    expect(() => c.parseDocxWithSpreadsheet(file, '')).toThrow();
  });

  it('import conflito/commit delegam ao ImportService', async () => {
    const { c } = make();
    await c.checkImportConflict('Ana', '111');
    await c.commitImport({ resident: { name: 'Ana' } } as never, user);
    expect(importSvc.checkConflict).toHaveBeenCalledWith('Ana', '111');
    expect(importSvc.commit).toHaveBeenCalledWith({ resident: { name: 'Ana' } }, 'u1');
  });

  it('follow-up endpoints delegate', async () => {
    const { c } = make();
    await c.getFollowUps('r1', user);
    await c.createFollowUp('r1', {} as never, user);
    await c.bulkCreateContributions('r1', {} as never, user);
    await c.uploadFollowUpAttachment('r1', 'f1', file);
    expect(followUp.findByResident).toHaveBeenCalledWith('r1', 'ADMIN');
    expect(followUp.create).toHaveBeenCalledWith('r1', {}, 'u1');
    expect(followUp.bulkCreateContributions).toHaveBeenCalledWith('r1', {}, 'u1');
    expect(followUp.uploadAttachment).toHaveBeenCalledWith('f1', 'r1', file);
  });

  it('receivable + plan endpoints delegate', async () => {
    const { c, rs } = make();
    await c.getReceivables('r1');
    await c.getReceivablesSummary('r1');
    expect(receivable.findSummaryByResident).toHaveBeenCalledWith('r1');
    await c.updateContributionPlan('r1', {} as never);
    await c.setContributionExempt('r1', { exempt: true } as never);
    await c.registerReceivablePayment('r1', 'rcv1', {} as never, user, file);
    await c.reopenReceivable('r1', 'rcv1');
    expect(receivable.findByResident).toHaveBeenCalledWith('r1');
    expect(rs.setContributionExempt).toHaveBeenCalledWith('r1', true);
    expect(receivable.registerPayment).toHaveBeenCalledWith('r1', 'rcv1', {}, 'u1', file);
    expect(receivable.reopenPayment).toHaveBeenCalledWith('r1', 'rcv1');
  });

  it('access endpoints delegate', async () => {
    const { c, rs } = make();
    await c.generateAccess('r1', { email: 'a@b.com', password: 'pw' } as never);
    await c.promoteToServant('r1', {} as never);
    await c.resetPassword('r1', { password: 'pw' } as never);
    expect(rs.generateAccess).toHaveBeenCalledWith('r1', 'a@b.com', 'pw');
    expect(rs.promoteToServant).toHaveBeenCalledWith('r1', {});
    expect(rs.resetPassword).toHaveBeenCalledWith('r1', 'pw');
  });

  it('document + attachment endpoints delegate', async () => {
    const { c, rs } = make();
    await c.uploadPhoto('r1', file);
    await c.getDocuments('r1');
    await c.getAdmissionDocuments('r1');
    await c.getAttachments('r1');
    await c.addAttachment('r1', { ...file, originalname: 'x.pdf' } as Express.Multer.File);
    await c.removeAttachment('r1', 'att1');
    await c.uploadSignedDocument('r1', 't1', file);
    expect(rs.uploadPhoto).toHaveBeenCalledWith('r1', file);
    expect(docTpl.findAdmissionTemplates).toHaveBeenCalled();
    expect(rs.findAdmissionDocuments).toHaveBeenCalledWith('r1', [{ id: 't1', name: 'Termo' }]);
    expect(rs.removeAttachment).toHaveBeenCalledWith('r1', 'att1');
  });

  it('renderDocument writes HTML to the response', async () => {
    const { c } = make();
    const res = { setHeader: jest.fn(), send: jest.fn() } as never;
    // Story 128 — o usuário do token é repassado ao service como signer.
    await c.renderDocument('r1', 't1', { userId: 'u1' } as never, res);
    expect(docTpl.renderForResident).toHaveBeenCalledWith('t1', { id: 'r1', name: 'Ana' }, 'u1');
    expect((res as { send: jest.Mock }).send).toHaveBeenCalledWith('<html></html>');
  });

  it('downloadPdf streams the PDF with headers', async () => {
    const { c } = make();
    const res = { setHeader: jest.fn(), send: jest.fn() } as never;
    await c.downloadPdf('r1', 't1', { userId: 'u1' } as never, res);
    expect(docTpl.generatePdf).toHaveBeenCalledWith('t1', { id: 'r1', name: 'Ana' }, 'u1');
    expect((res as { setHeader: jest.Mock }).setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect((res as { send: jest.Mock }).send).toHaveBeenCalled();
  });

  // Story 152 — PDF combinado para impressão em lote.
  it('downloadCombinedPdf streams the merged PDF with the combined filename', async () => {
    const { c } = make();
    const res = { setHeader: jest.fn(), send: jest.fn() } as never;
    await c.downloadCombinedPdf('r1', { templateIds: ['t1', 't2'] }, { userId: 'u1' } as never, res);
    expect(docTpl.generateCombinedPdf).toHaveBeenCalledWith(
      ['t1', 't2'],
      { id: 'r1', name: 'Ana' },
      'u1',
    );
    const setHeader = (res as { setHeader: jest.Mock }).setHeader;
    expect(setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(setHeader).toHaveBeenCalledWith(
      'Content-Disposition',
      'attachment; filename="ana-documentos.pdf"',
    );
    expect((res as { send: jest.Mock }).send).toHaveBeenCalledWith(Buffer.from('combined'));
  });

  // ── Story 186: o recorte do carnê ─────────────────────────────────────────
  describe('recorte do carnê (story 186)', () => {
    const roles = (fn: unknown) => Reflect.getMetadata(ROLES_KEY, fn as object);
    const path = (fn: unknown) => Reflect.getMetadata(PATH_METADATA, fn as object) as string;
    const proto = ResidentController.prototype;

    it('o recorte abre para o servo e o carnê cheio continua ADMIN/COORDINATOR', () => {
      expect(roles(proto.getReceivablesSummary)).toEqual([
        Role.ADMIN,
        Role.COORDINATOR,
        Role.SERVANT,
      ]);
      expect(roles(proto.getReceivables)).toEqual([Role.ADMIN, Role.COORDINATOR]);
    });

    it('a escrita financeira não pegou carona na liberação', () => {
      for (const handler of [
        proto.registerReceivablePayment,
        proto.reopenReceivable,
        proto.updateContributionPlan,
        proto.setContributionExempt,
      ]) {
        expect(roles(handler)).toEqual([Role.ADMIN, Role.COORDINATOR]);
      }
    });

    // Ordem de declaração É a ordem de rota no Nest: se `:id/receivables/summary`
    // cair depois de um `:id/receivables/:receivableId`, "summary" vira
    // `receivableId` e o `ParseUUIDPipe` devolve um 400 confuso no lugar da rota.
    it('é declarado antes de qualquer :id/receivables/:receivableId', () => {
      const handlers = Object.getOwnPropertyNames(proto).filter(
        (name) => name !== 'constructor',
      );
      const summaryIndex = handlers.indexOf('getReceivablesSummary');
      expect(summaryIndex).toBeGreaterThan(-1);

      const conflicting = handlers.filter((name) => {
        const route = path((proto as unknown as Record<string, unknown>)[name]);
        return typeof route === 'string' && route.startsWith(':id/receivables/:receivableId');
      });
      expect(conflicting.length).toBeGreaterThan(0);
      for (const name of conflicting) {
        expect(handlers.indexOf(name)).toBeGreaterThan(summaryIndex);
      }
    });
  });

  it('downloadCombinedPdf guarda os mesmos papéis do download individual e audita', () => {
    const roles = (fn: unknown) => Reflect.getMetadata(ROLES_KEY, fn as object);
    expect(roles(ResidentController.prototype.downloadCombinedPdf)).toEqual(
      roles(ResidentController.prototype.downloadPdf),
    );
    expect(roles(ResidentController.prototype.downloadCombinedPdf)).toEqual([
      Role.ADMIN,
      Role.COORDINATOR,
      Role.SERVANT,
    ]);
    expect(Reflect.getMetadata(AUDIT_KEY, ResidentController.prototype.downloadCombinedPdf)).toEqual({
      action: 'resident.document.combined-pdf',
      targetType: 'resident',
      targetParam: 'id',
    });
  });

  // ── Story 193: recibo da parcela paga ──────────────────────────────────────
  describe('recibo da contribuição do acolhido (story 193)', () => {
    it('delega ao ReceiptService com o usuário do TOKEN e devolve o PDF como anexo', async () => {
      const { c } = make();
      const res = { setHeader: jest.fn(), send: jest.fn() };

      await c.downloadReceivableReceipt('res-1', 'rcv-1', user, res as never);

      // O sujeito do recibo é a PARCELA; o residentId da URL apenas localiza.
      expect(receipts.generateForResidentReceivable).toHaveBeenCalledWith('rcv-1', 'u1');
      expect(res.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
      expect(res.setHeader).toHaveBeenCalledWith(
        'Content-Disposition',
        'attachment; filename="recibo-contribuicao-acolhido-000001.pdf"',
      );
      expect(res.send).toHaveBeenCalled();
    });

    it('é ADMIN/COORDINATOR e audita a PARCELA (não o filho)', () => {
      const proto = ResidentController.prototype;
      expect(Reflect.getMetadata(ROLES_KEY, proto.downloadReceivableReceipt)).toEqual([
        Role.ADMIN,
        Role.COORDINATOR,
      ]);
      expect(Reflect.getMetadata(AUDIT_KEY, proto.downloadReceivableReceipt)).toEqual({
        action: 'resident.receivable.receipt',
        targetType: 'resident-receivable',
        targetParam: 'receivableId',
      });
    });
  });
});
