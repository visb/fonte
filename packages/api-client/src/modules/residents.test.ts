import type { AxiosInstance } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createResidentsModule } from './residents.js';

function createHttpMock() {
  return {
    get: vi.fn().mockResolvedValue({ data: undefined }),
    post: vi.fn().mockResolvedValue({ data: undefined }),
    patch: vi.fn().mockResolvedValue({ data: undefined }),
    delete: vi.fn().mockResolvedValue({ data: undefined }),
  };
}

describe('residents module', () => {
  let http: ReturnType<typeof createHttpMock>;
  let residents: ReturnType<typeof createResidentsModule>;

  beforeEach(() => {
    http = createHttpMock();
    residents = createResidentsModule(http as unknown as AxiosInstance);
  });

  it('list repassa params e retorna r.data', async () => {
    const paged = { data: [], total: 0, page: 1, limit: 10 };
    http.get.mockResolvedValueOnce({ data: paged });

    const result = await residents.list({ page: 2, limit: 10, search: 'ana' });

    expect(http.get).toHaveBeenCalledWith('/residents', {
      params: { page: 2, limit: 10, search: 'ana' },
    });
    expect(result).toBe(paged);
  });

  it('listByHouse monta a URL aninhada por casa', async () => {
    await residents.listByHouse('house-1');
    expect(http.get).toHaveBeenCalledWith('/houses/house-1/residents');
  });

  it('getById monta a URL com o id', async () => {
    await residents.getById('res-1');
    expect(http.get).toHaveBeenCalledWith('/residents/res-1');
  });

  it('create envia o body por POST', async () => {
    const body = { name: 'Pedro', houseId: 'h1' };
    await residents.create(body);
    expect(http.post).toHaveBeenCalledWith('/residents', body);
  });

  it('update monta URL com id e envia body por PATCH', async () => {
    const body = { name: 'Pedro Silva' };
    await residents.update('res-2', body);
    expect(http.patch).toHaveBeenCalledWith('/residents/res-2', body);
  });

  it('delete chama DELETE no path com id', async () => {
    await residents.delete('res-3');
    expect(http.delete).toHaveBeenCalledWith('/residents/res-3');
  });

  it('uploadPhoto envia FormData com Content-Type undefined', async () => {
    const form = new FormData();
    await residents.uploadPhoto('res-4', form);
    expect(http.post).toHaveBeenCalledWith('/residents/res-4/photo', form, {
      headers: { 'Content-Type': undefined },
    });
  });

  it('contributionsReport repassa params no path de relatório', async () => {
    const params = { month: '2026-06' } as never;
    await residents.contributionsReport(params);
    expect(http.get).toHaveBeenCalledWith('/residents/contributions/report', { params });
  });

  it('setContributionExempt envia o flag no body', async () => {
    await residents.setContributionExempt('res-5', true);
    expect(http.patch).toHaveBeenCalledWith('/residents/res-5/contribution-exempt', {
      exempt: true,
    });
  });

  it('getDocuments busca documentos do residente', async () => {
    await residents.getDocuments('res-1');
    expect(http.get).toHaveBeenCalledWith('/residents/res-1/documents');
  });

  it('renderDocument monta rota de render por template', async () => {
    await residents.renderDocument('res-1', 'tpl-1');
    expect(http.get).toHaveBeenCalledWith('/residents/res-1/documents/tpl-1/render');
  });

  it('downloadDocumentPdf pede responseType blob', async () => {
    await residents.downloadDocumentPdf('res-1', 'tpl-1');
    expect(http.get).toHaveBeenCalledWith('/residents/res-1/documents/tpl-1/pdf', {
      responseType: 'blob',
    });
  });

  it('getAdmissionDocuments busca documentos de acolhimento', async () => {
    await residents.getAdmissionDocuments('res-1');
    expect(http.get).toHaveBeenCalledWith('/residents/res-1/admission-documents');
  });

  it('getAttachments busca anexos', async () => {
    await residents.getAttachments('res-1');
    expect(http.get).toHaveBeenCalledWith('/residents/res-1/attachments');
  });

  it('addAttachment envia FormData com Content-Type undefined', async () => {
    const form = new FormData();
    await residents.addAttachment('res-1', form);
    expect(http.post).toHaveBeenCalledWith('/residents/res-1/attachments', form, {
      headers: { 'Content-Type': undefined },
    });
  });

  it('deleteAttachment chama DELETE com attachmentId', async () => {
    await residents.deleteAttachment('res-1', 'att-1');
    expect(http.delete).toHaveBeenCalledWith('/residents/res-1/attachments/att-1');
  });

  it('uploadSignedDocument envia FormData na rota do template assinado', async () => {
    const form = new FormData();
    await residents.uploadSignedDocument('res-1', 'tpl-1', form);
    expect(http.post).toHaveBeenCalledWith('/residents/res-1/documents/tpl-1/signed', form, {
      headers: { 'Content-Type': undefined },
    });
  });

  it('readmit posta readmissão', async () => {
    const body = { houseId: 'h1' };
    await residents.readmit('res-1', body);
    expect(http.post).toHaveBeenCalledWith('/residents/res-1/readmit', body);
  });

  it('getAdmissions busca admissões', async () => {
    await residents.getAdmissions('res-1');
    expect(http.get).toHaveBeenCalledWith('/residents/res-1/admissions');
  });

  it('getFollowUps busca acompanhamentos', async () => {
    await residents.getFollowUps('res-1');
    expect(http.get).toHaveBeenCalledWith('/residents/res-1/follow-ups');
  });

  it('createFollowUp posta acompanhamento', async () => {
    const body = { date: '2026-01-01', type: 'NOTE', accessLevel: 'STAFF' } as never;
    await residents.createFollowUp('res-1', body);
    expect(http.post).toHaveBeenCalledWith('/residents/res-1/follow-ups', body);
  });

  it('uploadFollowUpAttachment envia FormData na rota do follow-up', async () => {
    const form = new FormData();
    await residents.uploadFollowUpAttachment('res-1', 'fu-1', form);
    expect(http.post).toHaveBeenCalledWith('/residents/res-1/follow-ups/fu-1/attachment', form, {
      headers: { 'Content-Type': undefined },
    });
  });

  it('getReceivables busca recebíveis', async () => {
    await residents.getReceivables('res-1');
    expect(http.get).toHaveBeenCalledWith('/residents/res-1/receivables');
  });

  it('registerReceivablePayment envia FormData na rota de pagamento', async () => {
    const form = new FormData();
    await residents.registerReceivablePayment('res-1', 'rc-1', form);
    expect(http.post).toHaveBeenCalledWith('/residents/res-1/receivables/rc-1/payment', form, {
      headers: { 'Content-Type': undefined },
    });
  });

  it('reopenReceivable posta reabertura com body vazio', async () => {
    await residents.reopenReceivable('res-1', 'rc-1');
    expect(http.post).toHaveBeenCalledWith('/residents/res-1/receivables/rc-1/reopen', {});
  });

  it('updateContributionPlan patcheia plano', async () => {
    const body = { contributionDueDay: 5 } as never;
    await residents.updateContributionPlan('res-1', body);
    expect(http.patch).toHaveBeenCalledWith('/residents/res-1/contribution-plan', body);
  });

  it('parseDocx envia FormData ao endpoint de import', async () => {
    const form = new FormData();
    await residents.parseDocx(form);
    expect(http.post).toHaveBeenCalledWith('/residents/import/parse-docx', form, {
      headers: { 'Content-Type': undefined },
    });
  });

  it('bulkCreateContributions posta lista de meses', async () => {
    const body = { months: [{ date: '2026-01-01' }] };
    await residents.bulkCreateContributions('res-1', body);
    expect(http.post).toHaveBeenCalledWith('/residents/res-1/follow-ups/bulk-contributions', body);
  });

  it('me busca o próprio residente', async () => {
    await residents.me();
    expect(http.get).toHaveBeenCalledWith('/residents/me');
  });

  it('uploadPhotoMe envia FormData na própria foto', async () => {
    const form = new FormData();
    await residents.uploadPhotoMe(form);
    expect(http.post).toHaveBeenCalledWith('/residents/me/photo', form, {
      headers: { 'Content-Type': undefined },
    });
  });

  it('generateAccess posta credenciais', async () => {
    const body = { email: 'a@b.c', password: 'pw' };
    await residents.generateAccess('res-1', body);
    expect(http.post).toHaveBeenCalledWith('/residents/res-1/access', body);
  });

  it('resetPassword posta e resolve undefined', async () => {
    const body = { password: 'nova' };
    const result = await residents.resetPassword('res-1', body);
    expect(http.post).toHaveBeenCalledWith('/residents/res-1/access/reset-password', body);
    expect(result).toBeUndefined();
  });

  it('promoteToServant posta promoção', async () => {
    const body = { rank: 'SERVO' } as never;
    await residents.promoteToServant('res-1', body);
    expect(http.post).toHaveBeenCalledWith('/residents/res-1/promote-to-servant', body);
  });

  it('exportData busca exportação LGPD', async () => {
    await residents.exportData('res-1');
    expect(http.get).toHaveBeenCalledWith('/residents/res-1/data-export');
  });

  it('anonymize posta anonimização com body vazio', async () => {
    await residents.anonymize('res-1');
    expect(http.post).toHaveBeenCalledWith('/residents/res-1/anonymize', {});
  });

  it('propaga erro HTTP no shape que getErrorMessage espera (message array)', async () => {
    const httpError = {
      response: { status: 422, data: { message: ['houseId é obrigatório'] } },
    };
    http.post.mockRejectedValueOnce(httpError);

    await expect(residents.create({ name: 'x', houseId: '' })).rejects.toMatchObject({
      response: { data: { message: ['houseId é obrigatório'] } },
    });
  });
});
