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
    await c.remove('r1');
    await c.readmit('r1', {} as never);
    await c.getAdmissions('r1');
    expect(rs.findAll).toHaveBeenCalledWith({}, { role: 'ADMIN', userId: 'u1' });
    expect(rs.findMe).toHaveBeenCalledWith('u1');
    expect(rs.create).toHaveBeenCalledWith({ name: 'Ana' });
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
    await c.renderDocument('r1', 't1', res);
    expect(docTpl.renderForResident).toHaveBeenCalledWith('t1', { id: 'r1', name: 'Ana' });
    expect((res as { send: jest.Mock }).send).toHaveBeenCalledWith('<html></html>');
  });

  it('downloadPdf streams the PDF with headers', async () => {
    const { c } = make();
    const res = { setHeader: jest.fn(), send: jest.fn() } as never;
    await c.downloadPdf('r1', 't1', res);
    expect(docTpl.generatePdf).toHaveBeenCalledWith('t1', { id: 'r1', name: 'Ana' });
    expect((res as { setHeader: jest.Mock }).setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect((res as { send: jest.Mock }).send).toHaveBeenCalled();
  });
});
