import type { AxiosInstance } from 'axios';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { createActivitiesModule } from './activities.js';
import { createAppSettingsModule } from './app-settings.js';
import { createAuditModule } from './audit.js';
import { createAuthModule } from './auth.js';
import { createBibleCourseModule } from './bible-course.js';
import { createCensusModule } from './census.js';
import { createConsentsModule } from './consents.js';
import { createDocumentTemplatesModule } from './document-templates.js';
import { createEventsModule } from './events.js';
import { createHousesModule } from './houses.js';
import { createIncidentsModule } from './incidents.js';
import { createMessagesModule } from './messages.js';
import { createMinistriesModule } from './ministries.js';
import { createNotificationsModule } from './notifications.js';
import { createRelativesModule } from './relatives.js';
import { createResidentSessionsModule } from './resident-sessions.js';
import { createStaffModule } from './staff.js';
import { createStoreroomModule } from './storeroom.js';
import { createStreetSalesModule } from './street-sales.js';
import { createSupplyRoomModule } from './supply-room.js';
import { createSupportGroupsModule } from './support-groups.js';
import { createWishlistModule } from './wishlist.js';

/**
 * Helper central de transport-mock. Cada método do http resolve por padrão com
 * `{ data: undefined }`; em testes específicos usamos `mockResolvedValueOnce`
 * com um sentinel para asserir a desserialização (`r.data`).
 */
function createHttpMock() {
  return {
    get: vi.fn().mockResolvedValue({ data: undefined }),
    post: vi.fn().mockResolvedValue({ data: undefined }),
    patch: vi.fn().mockResolvedValue({ data: undefined }),
    put: vi.fn().mockResolvedValue({ data: undefined }),
    delete: vi.fn().mockResolvedValue({ data: undefined }),
  };
}

type HttpMock = ReturnType<typeof createHttpMock>;
const asHttp = (h: HttpMock) => h as unknown as AxiosInstance;

// ── activities ───────────────────────────────────────────────────────────────
describe('activities module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createActivitiesModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createActivitiesModule(asHttp(http));
  });

  it('list repassa params e desserializa r.data', async () => {
    const sentinel = [{ id: 'a1' }];
    http.get.mockResolvedValueOnce({ data: sentinel });
    const result = await m.list({ houseId: 'h1' } as never);
    expect(http.get).toHaveBeenCalledWith('/activities', { params: { houseId: 'h1' } });
    expect(result).toBe(sentinel);
  });
  it('getById monta URL com id', async () => {
    await m.getById('a1');
    expect(http.get).toHaveBeenCalledWith('/activities/a1');
  });
  it('create envia body por POST', async () => {
    const body = { title: 'x' } as never;
    await m.create(body);
    expect(http.post).toHaveBeenCalledWith('/activities', body);
  });
  it('update envia body por PATCH', async () => {
    const body = { title: 'y' } as never;
    await m.update('a1', body);
    expect(http.patch).toHaveBeenCalledWith('/activities/a1', body);
  });
  it('changeStatus usa rota /status', async () => {
    const body = { status: 'DONE' } as never;
    await m.changeStatus('a1', body);
    expect(http.patch).toHaveBeenCalledWith('/activities/a1/status', body);
  });
  it('remove chama DELETE', async () => {
    await m.remove('a1');
    expect(http.delete).toHaveBeenCalledWith('/activities/a1');
  });
  it('listComments monta rota aninhada', async () => {
    await m.listComments('a1');
    expect(http.get).toHaveBeenCalledWith('/activities/a1/comments');
  });
  it('addComment envia body', async () => {
    const body = { text: 'oi' } as never;
    await m.addComment('a1', body);
    expect(http.post).toHaveBeenCalledWith('/activities/a1/comments', body);
  });
  it('deleteComment monta rota com commentId', async () => {
    await m.deleteComment('a1', 'c1');
    expect(http.delete).toHaveBeenCalledWith('/activities/a1/comments/c1');
  });
  it('listEvents monta rota de eventos', async () => {
    await m.listEvents('a1');
    expect(http.get).toHaveBeenCalledWith('/activities/a1/events');
  });
  it('uploadAttachment envia FormData com Content-Type undefined', async () => {
    const form = new FormData();
    await m.uploadAttachment('a1', form);
    expect(http.post).toHaveBeenCalledWith('/activities/a1/attachments', form, {
      headers: { 'Content-Type': undefined },
    });
  });
  it('uploadCommentAttachment envia FormData na rota do comentário', async () => {
    const form = new FormData();
    await m.uploadCommentAttachment('a1', 'c1', form);
    expect(http.post).toHaveBeenCalledWith('/activities/a1/comments/c1/attachments', form, {
      headers: { 'Content-Type': undefined },
    });
  });
  it('deleteAttachment monta rota com attachmentId', async () => {
    await m.deleteAttachment('a1', 'att1');
    expect(http.delete).toHaveBeenCalledWith('/activities/a1/attachments/att1');
  });
});

// ── app-settings ───────────────────────────────────────────────────────────────
describe('app-settings module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createAppSettingsModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createAppSettingsModule(asHttp(http));
  });
  it('get busca /app-settings e desserializa', async () => {
    const sentinel = { id: 's1' };
    http.get.mockResolvedValueOnce({ data: sentinel });
    expect(await m.get()).toBe(sentinel);
    expect(http.get).toHaveBeenCalledWith('/app-settings');
  });
  it('update envia body por PATCH', async () => {
    const body = { dailyUsageMinutes: 30 };
    await m.update(body);
    expect(http.patch).toHaveBeenCalledWith('/app-settings', body);
  });
});

// ── audit ───────────────────────────────────────────────────────────────────────
describe('audit module', () => {
  it('byTarget monta rota com tipo e id', async () => {
    const http = createHttpMock();
    const m = createAuditModule(asHttp(http));
    const sentinel = [{ id: 'log1' }];
    http.get.mockResolvedValueOnce({ data: sentinel });
    expect(await m.byTarget('RESIDENT', 'r1')).toBe(sentinel);
    expect(http.get).toHaveBeenCalledWith('/audit/RESIDENT/r1');
  });
});

// ── auth ─────────────────────────────────────────────────────────────────────────
describe('auth module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createAuthModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createAuthModule(asHttp(http));
  });
  it('login posta credenciais e desserializa', async () => {
    const sentinel = { accessToken: 'jwt', profileType: 'STAFF' };
    http.post.mockResolvedValueOnce({ data: sentinel });
    const body = { identifier: 'a@b.c', password: 'pw' };
    expect(await m.login(body)).toBe(sentinel);
    expect(http.post).toHaveBeenCalledWith('/auth/login', body);
  });
  it('changePassword posta no endpoint correto', async () => {
    const body = { newPassword: 'novo' };
    await m.changePassword(body);
    expect(http.post).toHaveBeenCalledWith('/auth/change-password', body);
  });
});

// ── bible-course ───────────────────────────────────────────────────────────────
describe('bible-course module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createBibleCourseModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createBibleCourseModule(asHttp(http));
  });
  it('listModules busca módulos', async () => {
    await m.listModules();
    expect(http.get).toHaveBeenCalledWith('/bible-course/modules');
  });
  it('createModule posta body', async () => {
    const body = { name: 'M1' };
    await m.createModule(body);
    expect(http.post).toHaveBeenCalledWith('/bible-course/modules', body);
  });
  it('updateModule patcheia por id', async () => {
    const body = { name: 'M2' };
    await m.updateModule('m1', body);
    expect(http.patch).toHaveBeenCalledWith('/bible-course/modules/m1', body);
  });
  it('deleteModule chama DELETE', async () => {
    await m.deleteModule('m1');
    expect(http.delete).toHaveBeenCalledWith('/bible-course/modules/m1');
  });
  it('listClasses sem status manda params undefined', async () => {
    await m.listClasses();
    expect(http.get).toHaveBeenCalledWith('/bible-course/classes', { params: undefined });
  });
  it('listClasses com status filtra', async () => {
    await m.listClasses('IN_PROGRESS');
    expect(http.get).toHaveBeenCalledWith('/bible-course/classes', {
      params: { status: 'IN_PROGRESS' },
    });
  });
  it('createClass posta body', async () => {
    const body = { name: 'T1' } as never;
    await m.createClass(body);
    expect(http.post).toHaveBeenCalledWith('/bible-course/classes', body);
  });
  it('getClass busca detalhe', async () => {
    await m.getClass('c1');
    expect(http.get).toHaveBeenCalledWith('/bible-course/classes/c1');
  });
  it('updateClass patcheia', async () => {
    const body = { name: 'T2' };
    await m.updateClass('c1', body);
    expect(http.patch).toHaveBeenCalledWith('/bible-course/classes/c1', body);
  });
  it('deleteClass chama DELETE', async () => {
    await m.deleteClass('c1');
    expect(http.delete).toHaveBeenCalledWith('/bible-course/classes/c1');
  });
  it('enroll posta matrícula na turma', async () => {
    const body = { residentId: 'r1' };
    await m.enroll('c1', body);
    expect(http.post).toHaveBeenCalledWith('/bible-course/classes/c1/enrollments', body);
  });
  it('updateEnrollment patcheia', async () => {
    const body = { status: 'COMPLETED' as const };
    await m.updateEnrollment('e1', body);
    expect(http.patch).toHaveBeenCalledWith('/bible-course/enrollments/e1', body);
  });
  it('removeEnrollment chama DELETE', async () => {
    await m.removeEnrollment('e1');
    expect(http.delete).toHaveBeenCalledWith('/bible-course/enrollments/e1');
  });
  it('getClassGrades busca notas', async () => {
    await m.getClassGrades('c1');
    expect(http.get).toHaveBeenCalledWith('/bible-course/classes/c1/grades');
  });
  it('upsertGrade usa PUT na rota de nota', async () => {
    const body = { examGrade: 9 };
    await m.upsertGrade('e1', 'm1', body);
    expect(http.put).toHaveBeenCalledWith('/bible-course/enrollments/e1/grades/m1', body);
  });
});

// ── census ───────────────────────────────────────────────────────────────────
describe('census module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createCensusModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createCensusModule(asHttp(http));
  });
  it('addResident posta filho na contagem', async () => {
    const body = { name: 'João', houseId: 'h1' };
    await m.addResident(body);
    expect(http.post).toHaveBeenCalledWith('/census/residents', body);
  });
  it('conclude posta conclusão', async () => {
    const body = { houseId: 'h1', confirmedCount: 2, total: 2 };
    await m.conclude(body);
    expect(http.post).toHaveBeenCalledWith('/census/conclude', body);
  });
  it('listPending busca pendentes da casa', async () => {
    await m.listPending('h1');
    expect(http.get).toHaveBeenCalledWith('/census/houses/h1/pending');
  });
  it('approveAll posta aprovação em massa', async () => {
    await m.approveAll('h1');
    expect(http.post).toHaveBeenCalledWith('/census/houses/h1/approve-all');
  });
  it('reject patcheia o filho', async () => {
    await m.reject('r1');
    expect(http.patch).toHaveBeenCalledWith('/census/residents/r1/reject');
  });
});

// ── consents ───────────────────────────────────────────────────────────────────
describe('consents module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createConsentsModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createConsentsModule(asHttp(http));
  });
  it('grant posta consentimento', async () => {
    const body = { subjectType: 'RESIDENT' as const, subjectId: 'r1', purpose: 'IMAGE_PUBLICATION' as const };
    await m.grant(body);
    expect(http.post).toHaveBeenCalledWith('/consents', body);
  });
  it('revoke posta revogação', async () => {
    const body = { subjectType: 'RESIDENT' as const, subjectId: 'r1', purpose: 'IMAGE_PUBLICATION' as const };
    await m.revoke(body);
    expect(http.post).toHaveBeenCalledWith('/consents/revoke', body);
  });
  it('status busca status do titular', async () => {
    await m.status('RESIDENT', 'r1');
    expect(http.get).toHaveBeenCalledWith('/consents/RESIDENT/r1');
  });
  it('history busca histórico', async () => {
    await m.history('RELATIVE', 'rel1');
    expect(http.get).toHaveBeenCalledWith('/consents/RELATIVE/rel1/history');
  });
  it('checkActive manda params na query', async () => {
    await m.checkActive('RESIDENT', 'r1', 'RELIGIOUS_DISCLOSURE');
    expect(http.get).toHaveBeenCalledWith('/consents/check/active', {
      params: { subjectType: 'RESIDENT', subjectId: 'r1', purpose: 'RELIGIOUS_DISCLOSURE' },
    });
  });
  it('myStatus busca /consents/me', async () => {
    await m.myStatus();
    expect(http.get).toHaveBeenCalledWith('/consents/me');
  });
  it('myGrant usa termVersion default 1.0', async () => {
    await m.myGrant('IMAGE_PUBLICATION');
    expect(http.post).toHaveBeenCalledWith('/consents/me/grant', {
      purpose: 'IMAGE_PUBLICATION',
      termVersion: '1.0',
    });
  });
  it('myGrant aceita termVersion custom', async () => {
    await m.myGrant('IMAGE_PUBLICATION', '2.1');
    expect(http.post).toHaveBeenCalledWith('/consents/me/grant', {
      purpose: 'IMAGE_PUBLICATION',
      termVersion: '2.1',
    });
  });
  it('myRevoke posta revogação do titular', async () => {
    await m.myRevoke('RELIGIOUS_DISCLOSURE');
    expect(http.post).toHaveBeenCalledWith('/consents/me/revoke', { purpose: 'RELIGIOUS_DISCLOSURE' });
  });
});

// ── document-templates ───────────────────────────────────────────────────────
describe('document-templates module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createDocumentTemplatesModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createDocumentTemplatesModule(asHttp(http));
  });
  it('list busca templates', async () => {
    await m.list();
    expect(http.get).toHaveBeenCalledWith('/document-templates');
  });
  it('getById busca por id', async () => {
    await m.getById('t1');
    expect(http.get).toHaveBeenCalledWith('/document-templates/t1');
  });
  it('create posta body', async () => {
    const body = { name: 'X', content: 'c', isRequired: true };
    await m.create(body);
    expect(http.post).toHaveBeenCalledWith('/document-templates', body);
  });
  it('update usa PUT', async () => {
    const body = { name: 'Y' };
    await m.update('t1', body);
    expect(http.put).toHaveBeenCalledWith('/document-templates/t1', body);
  });
  it('delete chama DELETE', async () => {
    await m.delete('t1');
    expect(http.delete).toHaveBeenCalledWith('/document-templates/t1');
  });
  it('uploadImage envia FormData e desserializa url', async () => {
    const form = new FormData();
    const sentinel = { url: 'http://x/y.png' };
    http.post.mockResolvedValueOnce({ data: sentinel });
    expect(await m.uploadImage(form)).toBe(sentinel);
    expect(http.post).toHaveBeenCalledWith('/document-templates/images', form, {
      headers: { 'Content-Type': undefined },
    });
  });
});

// ── events ───────────────────────────────────────────────────────────────────
describe('events module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createEventsModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createEventsModule(asHttp(http));
  });
  it('list repassa params', async () => {
    await m.list({ filter: 'UPCOMING' } as never);
    expect(http.get).toHaveBeenCalledWith('/events', { params: { filter: 'UPCOMING' } });
  });
  it('getById busca por id', async () => {
    await m.getById('e1');
    expect(http.get).toHaveBeenCalledWith('/events/e1');
  });
  it('create posta body', async () => {
    const body = { title: 'Festa' } as never;
    await m.create(body);
    expect(http.post).toHaveBeenCalledWith('/events', body);
  });
  it('update patcheia', async () => {
    const body = { title: 'Festa 2' } as never;
    await m.update('e1', body);
    expect(http.patch).toHaveBeenCalledWith('/events/e1', body);
  });
  it('remove chama DELETE', async () => {
    await m.remove('e1');
    expect(http.delete).toHaveBeenCalledWith('/events/e1');
  });
  it('uploadBanner envia FormData', async () => {
    const form = new FormData();
    await m.uploadBanner('e1', form);
    expect(http.post).toHaveBeenCalledWith('/events/e1/banner', form, {
      headers: { 'Content-Type': undefined },
    });
  });
  it('listRegistrations busca inscritos', async () => {
    await m.listRegistrations('e1');
    expect(http.get).toHaveBeenCalledWith('/events/e1/registrations');
  });
  it('public.list busca eventos públicos', async () => {
    await m.public.list();
    expect(http.get).toHaveBeenCalledWith('/public/events');
  });
  it('public.getById busca evento público', async () => {
    await m.public.getById('e1');
    expect(http.get).toHaveBeenCalledWith('/public/events/e1');
  });
  it('public.register posta inscrição', async () => {
    const body = { name: 'Ana' } as never;
    await m.public.register('e1', body);
    expect(http.post).toHaveBeenCalledWith('/public/events/e1/register', body);
  });
  it('public.uploadRegistrationFile envia FormData', async () => {
    const form = new FormData();
    await m.public.uploadRegistrationFile('e1', form);
    expect(http.post).toHaveBeenCalledWith('/public/events/e1/registration-files', form, {
      headers: { 'Content-Type': undefined },
    });
  });
  it('payments.getByToken busca por token', async () => {
    await m.payments.getByToken('tok1');
    expect(http.get).toHaveBeenCalledWith('/public/event-payments/tok1');
  });
  it('payments.pay posta pagamento e desserializa', async () => {
    const body = { method: 'PIX' } as never;
    const sentinel = { status: 'PAID' };
    http.post.mockResolvedValueOnce({ data: sentinel });
    expect(await m.payments.pay('tok1', body)).toBe(sentinel);
    expect(http.post).toHaveBeenCalledWith('/public/event-payments/tok1/pay', body);
  });
});

// ── houses ───────────────────────────────────────────────────────────────────
describe('houses module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createHousesModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createHousesModule(asHttp(http));
  });
  it('list busca casas', async () => {
    await m.list();
    expect(http.get).toHaveBeenCalledWith('/houses');
  });
  it('getById busca por id', async () => {
    await m.getById('h1');
    expect(http.get).toHaveBeenCalledWith('/houses/h1');
  });
  it('create posta body', async () => {
    const body = { name: 'Casa 1' };
    await m.create(body);
    expect(http.post).toHaveBeenCalledWith('/houses', body);
  });
  it('update patcheia', async () => {
    const body = { name: 'Casa 2' };
    await m.update('h1', body);
    expect(http.patch).toHaveBeenCalledWith('/houses/h1', body);
  });
  it('delete chama DELETE', async () => {
    await m.delete('h1');
    expect(http.delete).toHaveBeenCalledWith('/houses/h1');
  });
  it('addPhoto envia FormData', async () => {
    const form = new FormData();
    await m.addPhoto('h1', form);
    expect(http.post).toHaveBeenCalledWith('/houses/h1/photos', form, {
      headers: { 'Content-Type': undefined },
    });
  });
  it('deletePhoto chama DELETE com photoId', async () => {
    await m.deletePhoto('h1', 'p1');
    expect(http.delete).toHaveBeenCalledWith('/houses/h1/photos/p1');
  });
  it('listResidents busca residentes da casa', async () => {
    await m.listResidents('h1');
    expect(http.get).toHaveBeenCalledWith('/houses/h1/residents');
  });
  it('listStaff busca staff da casa', async () => {
    await m.listStaff('h1');
    expect(http.get).toHaveBeenCalledWith('/houses/h1/staff');
  });
  it('listMinistries busca ministérios', async () => {
    await m.listMinistries('h1');
    expect(http.get).toHaveBeenCalledWith('/houses/h1/ministries');
  });
  it('addMinistry posta ministério', async () => {
    const body = { name: 'Cozinha' };
    await m.addMinistry('h1', body);
    expect(http.post).toHaveBeenCalledWith('/houses/h1/ministries', body);
  });
  it('listRules busca regras', async () => {
    await m.listRules('h1');
    expect(http.get).toHaveBeenCalledWith('/houses/h1/rules');
  });
  it('createRule posta regra', async () => {
    const body = { title: 'T', content: 'C' };
    await m.createRule('h1', body);
    expect(http.post).toHaveBeenCalledWith('/houses/h1/rules', body);
  });
  it('deleteRule chama DELETE com ruleId', async () => {
    await m.deleteRule('h1', 'r1');
    expect(http.delete).toHaveBeenCalledWith('/houses/h1/rules/r1');
  });
  it('createCapacityRequest posta pedido', async () => {
    const body = { generalCapacity: 10, staffCapacity: 2 };
    await m.createCapacityRequest('h1', body);
    expect(http.post).toHaveBeenCalledWith('/houses/h1/capacity-requests', body);
  });
  it('listCapacityRequests busca pedidos da casa', async () => {
    await m.listCapacityRequests('h1');
    expect(http.get).toHaveBeenCalledWith('/houses/h1/capacity-requests');
  });
  it('getCapacityRequest busca pedido por id', async () => {
    await m.getCapacityRequest('req1');
    expect(http.get).toHaveBeenCalledWith('/house-capacity-requests/req1');
  });
  it('approveCapacityRequest patcheia aprovação', async () => {
    await m.approveCapacityRequest('req1');
    expect(http.patch).toHaveBeenCalledWith('/house-capacity-requests/req1/approve');
  });
  it('rejectCapacityRequest patcheia rejeição', async () => {
    await m.rejectCapacityRequest('req1');
    expect(http.patch).toHaveBeenCalledWith('/house-capacity-requests/req1/reject');
  });
});

// ── incidents ───────────────────────────────────────────────────────────────────
describe('incidents module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createIncidentsModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createIncidentsModule(asHttp(http));
  });
  it('list repassa params', async () => {
    await m.list({ houseId: 'h1' });
    expect(http.get).toHaveBeenCalledWith('/incidents', { params: { houseId: 'h1' } });
  });
  it('getById busca por id', async () => {
    await m.getById('i1');
    expect(http.get).toHaveBeenCalledWith('/incidents/i1');
  });
  it('create posta body', async () => {
    const body = { date: '2026-01-01' } as never;
    await m.create(body);
    expect(http.post).toHaveBeenCalledWith('/incidents', body);
  });
});

// ── messages ───────────────────────────────────────────────────────────────────
describe('messages module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createMessagesModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createMessagesModule(asHttp(http));
  });
  it('getConversations busca conversas', async () => {
    await m.getConversations();
    expect(http.get).toHaveBeenCalledWith('/messages/conversations');
  });
  it('getMyConversations busca minhas conversas', async () => {
    await m.getMyConversations();
    expect(http.get).toHaveBeenCalledWith('/messages/my-conversations');
  });
  it('getThread monta rota com residentId e relativeId', async () => {
    await m.getThread('r1', 'rel1');
    expect(http.get).toHaveBeenCalledWith('/messages/conversations/r1/rel1');
  });
  it('getPending busca pendentes', async () => {
    await m.getPending();
    expect(http.get).toHaveBeenCalledWith('/messages/pending');
  });
  it('send posta mensagem', async () => {
    const body = { residentId: 'r1', relativeId: 'rel1', content: 'oi' };
    await m.send(body);
    expect(http.post).toHaveBeenCalledWith('/messages', body);
  });
  it('approve patcheia aprovação', async () => {
    await m.approve('m1');
    expect(http.patch).toHaveBeenCalledWith('/messages/m1/approve');
  });
  it('reject patcheia rejeição', async () => {
    await m.reject('m1');
    expect(http.patch).toHaveBeenCalledWith('/messages/m1/reject');
  });
  it('getHouseStaffThreads busca threads de staff', async () => {
    await m.getHouseStaffThreads();
    expect(http.get).toHaveBeenCalledWith('/messages/house-staff-threads');
  });
  it('getDirectConversations busca conversas diretas', async () => {
    await m.getDirectConversations();
    expect(http.get).toHaveBeenCalledWith('/messages/direct-conversations');
  });
  it('getDirectThread monta rota direta', async () => {
    await m.getDirectThread('s1', 'rel1');
    expect(http.get).toHaveBeenCalledWith('/messages/direct/s1/rel1');
  });
  it('sendDirect posta mensagem direta', async () => {
    const body = { staffId: 's1', relativeId: 'rel1', content: 'oi' };
    await m.sendDirect(body);
    expect(http.post).toHaveBeenCalledWith('/messages/direct', body);
  });
  it('uploadAttachment envia FormData com multipart/form-data', async () => {
    const form = new FormData();
    const sentinel = { url: 'u', type: 'image' };
    http.post.mockResolvedValueOnce({ data: sentinel });
    expect(await m.uploadAttachment(form)).toBe(sentinel);
    expect(http.post).toHaveBeenCalledWith('/messages/upload', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });
  });
});

// ── ministries ───────────────────────────────────────────────────────────────
describe('ministries module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createMinistriesModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createMinistriesModule(asHttp(http));
  });
  it('getById busca detalhe', async () => {
    await m.getById('mi1');
    expect(http.get).toHaveBeenCalledWith('/ministries/mi1');
  });
  it('update patcheia', async () => {
    const body = { name: 'Novo' };
    await m.update('mi1', body);
    expect(http.patch).toHaveBeenCalledWith('/ministries/mi1', body);
  });
  it('delete chama DELETE', async () => {
    await m.delete('mi1');
    expect(http.delete).toHaveBeenCalledWith('/ministries/mi1');
  });
  it('addResident posta residentId no body', async () => {
    await m.addResident('mi1', 'r1');
    expect(http.post).toHaveBeenCalledWith('/ministries/mi1/residents', { residentId: 'r1' });
  });
  it('removeResident chama DELETE', async () => {
    await m.removeResident('mi1', 'r1');
    expect(http.delete).toHaveBeenCalledWith('/ministries/mi1/residents/r1');
  });
  it('addStaff posta staffId no body', async () => {
    await m.addStaff('mi1', 's1');
    expect(http.post).toHaveBeenCalledWith('/ministries/mi1/staff', { staffId: 's1' });
  });
  it('removeStaff chama DELETE', async () => {
    await m.removeStaff('mi1', 's1');
    expect(http.delete).toHaveBeenCalledWith('/ministries/mi1/staff/s1');
  });
  it('listTasks busca tarefas', async () => {
    await m.listTasks('mi1');
    expect(http.get).toHaveBeenCalledWith('/ministries/mi1/tasks');
  });
  it('createTask posta tarefa', async () => {
    const body = { title: 'T' };
    await m.createTask('mi1', body);
    expect(http.post).toHaveBeenCalledWith('/ministries/mi1/tasks', body);
  });
  it('updateTask patcheia tarefa', async () => {
    const body = { completed: true };
    await m.updateTask('mi1', 't1', body);
    expect(http.patch).toHaveBeenCalledWith('/ministries/mi1/tasks/t1', body);
  });
  it('deleteTask chama DELETE', async () => {
    await m.deleteTask('mi1', 't1');
    expect(http.delete).toHaveBeenCalledWith('/ministries/mi1/tasks/t1');
  });
});

// ── notifications ───────────────────────────────────────────────────────────────
describe('notifications module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createNotificationsModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createNotificationsModule(asHttp(http));
  });
  it('list sem params manda unreadOnly undefined', async () => {
    await m.list();
    expect(http.get).toHaveBeenCalledWith('/notifications', {
      params: { unreadOnly: undefined, page: undefined },
    });
  });
  it('list com unreadOnly true serializa string "true"', async () => {
    await m.list({ unreadOnly: true, page: 2 });
    expect(http.get).toHaveBeenCalledWith('/notifications', {
      params: { unreadOnly: 'true', page: 2 },
    });
  });
  it('unreadCount busca contagem', async () => {
    await m.unreadCount();
    expect(http.get).toHaveBeenCalledWith('/notifications/unread-count');
  });
  it('markRead patcheia leitura', async () => {
    await m.markRead('n1');
    expect(http.patch).toHaveBeenCalledWith('/notifications/n1/read');
  });
  it('markAllRead patcheia todas', async () => {
    await m.markAllRead();
    expect(http.patch).toHaveBeenCalledWith('/notifications/read-all');
  });
});

// ── relatives ───────────────────────────────────────────────────────────────────
describe('relatives module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createRelativesModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createRelativesModule(asHttp(http));
  });
  it('me busca /relatives/me', async () => {
    await m.me();
    expect(http.get).toHaveBeenCalledWith('/relatives/me');
  });
  it('updateMe patcheia', async () => {
    const body = { name: 'Maria' };
    await m.updateMe(body);
    expect(http.patch).toHaveBeenCalledWith('/relatives/me', body);
  });
  it('uploadPhotoMe envia FormData', async () => {
    const form = new FormData();
    await m.uploadPhotoMe(form);
    expect(http.post).toHaveBeenCalledWith('/relatives/me/photo', form, {
      headers: { 'Content-Type': undefined },
    });
  });
  it('listByResident manda residentId como query', async () => {
    await m.listByResident('r1');
    expect(http.get).toHaveBeenCalledWith('/relatives', { params: { residentId: 'r1' } });
  });
  it('create posta body', async () => {
    const body = { name: 'Ana', residentId: 'r1' };
    await m.create(body);
    expect(http.post).toHaveBeenCalledWith('/relatives', body);
  });
  it('setResponsible patcheia', async () => {
    await m.setResponsible('rel1');
    expect(http.patch).toHaveBeenCalledWith('/relatives/rel1/responsible');
  });
  it('delete chama DELETE', async () => {
    await m.delete('rel1');
    expect(http.delete).toHaveBeenCalledWith('/relatives/rel1');
  });
  it('generateAccess posta credenciais', async () => {
    const body = { email: 'a@b.c', password: 'pw' };
    await m.generateAccess('rel1', body);
    expect(http.post).toHaveBeenCalledWith('/relatives/rel1/access', body);
  });
  it('resetPassword posta e resolve undefined', async () => {
    const body = { password: 'nova' };
    const result = await m.resetPassword('rel1', body);
    expect(http.post).toHaveBeenCalledWith('/relatives/rel1/access/reset-password', body);
    expect(result).toBeUndefined();
  });
});

// ── resident-sessions ───────────────────────────────────────────────────────────
describe('resident-sessions module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createResidentSessionsModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createResidentSessionsModule(asHttp(http));
  });
  it('getToday busca uso de hoje', async () => {
    await m.getToday();
    expect(http.get).toHaveBeenCalledWith('/resident-sessions/today');
  });
  it('heartbeat posta segundos no body', async () => {
    await m.heartbeat(30);
    expect(http.post).toHaveBeenCalledWith('/resident-sessions/heartbeat', { seconds: 30 });
  });
  it('reset posta e resolve undefined', async () => {
    const result = await m.reset('r1');
    expect(http.post).toHaveBeenCalledWith('/resident-sessions/r1/reset');
    expect(result).toBeUndefined();
  });
});

// ── staff ───────────────────────────────────────────────────────────────────────
describe('staff module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createStaffModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createStaffModule(asHttp(http));
  });
  it('me busca /staff/me', async () => {
    await m.me();
    expect(http.get).toHaveBeenCalledWith('/staff/me');
  });
  it('updateMe patcheia', async () => {
    const body = { name: 'Z' };
    await m.updateMe(body);
    expect(http.patch).toHaveBeenCalledWith('/staff/me', body);
  });
  it('uploadPhotoMe envia FormData', async () => {
    const form = new FormData();
    await m.uploadPhotoMe(form);
    expect(http.post).toHaveBeenCalledWith('/staff/me/photo', form, {
      headers: { 'Content-Type': undefined },
    });
  });
  it('list busca staff', async () => {
    await m.list();
    expect(http.get).toHaveBeenCalledWith('/staff');
  });
  it('getById busca por id', async () => {
    await m.getById('s1');
    expect(http.get).toHaveBeenCalledWith('/staff/s1');
  });
  it('create posta body', async () => {
    const body = { name: 'Novo', password: 'pw', role: 'SERVANT' } as never;
    await m.create(body);
    expect(http.post).toHaveBeenCalledWith('/staff', body);
  });
  it('update patcheia', async () => {
    const body = { name: 'Novo 2' };
    await m.update('s1', body);
    expect(http.patch).toHaveBeenCalledWith('/staff/s1', body);
  });
  it('uploadPhoto envia FormData', async () => {
    const form = new FormData();
    await m.uploadPhoto('s1', form);
    expect(http.post).toHaveBeenCalledWith('/staff/s1/photo', form, {
      headers: { 'Content-Type': undefined },
    });
  });
  it('delete chama DELETE', async () => {
    await m.delete('s1');
    expect(http.delete).toHaveBeenCalledWith('/staff/s1');
  });
  it('getPermissions busca permissões', async () => {
    await m.getPermissions('s1');
    expect(http.get).toHaveBeenCalledWith('/staff/s1/permissions');
  });
  it('addPermission posta permissão', async () => {
    const body = { type: 'MANAGE_HOUSES' } as never;
    await m.addPermission('s1', body);
    expect(http.post).toHaveBeenCalledWith('/staff/s1/permissions', body);
  });
  it('removePermission chama DELETE e resolve undefined', async () => {
    const result = await m.removePermission('s1', 'MANAGE_HOUSES' as never);
    expect(http.delete).toHaveBeenCalledWith('/staff/s1/permissions/MANAGE_HOUSES');
    expect(result).toBeUndefined();
  });
});

// ── storeroom ───────────────────────────────────────────────────────────────────
describe('storeroom module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createStoreroomModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createStoreroomModule(asHttp(http));
  });
  it('listItems repassa params', async () => {
    await m.listItems({ houseId: 'h1' });
    expect(http.get).toHaveBeenCalledWith('/storerooms/items', { params: { houseId: 'h1' } });
  });
  it('createItem posta body', async () => {
    const body = { name: 'Arroz', unit: 'kg', houseId: 'h1' };
    await m.createItem(body);
    expect(http.post).toHaveBeenCalledWith('/storerooms/items', body);
  });
  it('updateItem patcheia', async () => {
    const body = { name: 'Feijão' };
    await m.updateItem('it1', body);
    expect(http.patch).toHaveBeenCalledWith('/storerooms/items/it1', body);
  });
  it('deleteItem chama DELETE', async () => {
    await m.deleteItem('it1');
    expect(http.delete).toHaveBeenCalledWith('/storerooms/items/it1');
  });
  it('listMovements repassa params', async () => {
    await m.listMovements({ itemId: 'it1' });
    expect(http.get).toHaveBeenCalledWith('/storerooms/movements', { params: { itemId: 'it1' } });
  });
  it('createMovement posta body', async () => {
    const body = { itemId: 'it1', type: 'IN', quantity: 5, responsibleId: 's1', date: '2026-01-01' } as never;
    await m.createMovement(body);
    expect(http.post).toHaveBeenCalledWith('/storerooms/movements', body);
  });
});

// ── street-sales ───────────────────────────────────────────────────────────────
describe('street-sales module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createStreetSalesModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createStreetSalesModule(asHttp(http));
  });
  it('create posta body', async () => {
    const body = { houseId: 'h1' } as never;
    await m.create(body);
    expect(http.post).toHaveBeenCalledWith('/street-sales', body);
  });
  it('list repassa params', async () => {
    await m.list({ houseId: 'h1' });
    expect(http.get).toHaveBeenCalledWith('/street-sales', { params: { houseId: 'h1' } });
  });
  it('report repassa params do relatório', async () => {
    const params = { type: 'PASTEL', month: '2026-06' } as never;
    await m.report(params);
    expect(http.get).toHaveBeenCalledWith('/street-sales/report', { params });
  });
  it('findOne busca por id', async () => {
    await m.findOne('ss1');
    expect(http.get).toHaveBeenCalledWith('/street-sales/ss1');
  });
  it('update patcheia', async () => {
    const body = { quantity: 10 };
    await m.update('ss1', body);
    expect(http.patch).toHaveBeenCalledWith('/street-sales/ss1', body);
  });
  it('remove chama DELETE', async () => {
    await m.remove('ss1');
    expect(http.delete).toHaveBeenCalledWith('/street-sales/ss1');
  });
});

// ── supply-room ───────────────────────────────────────────────────────────────
describe('supply-room module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createSupplyRoomModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createSupplyRoomModule(asHttp(http));
  });
  it('listItems repassa params', async () => {
    await m.listItems({ houseId: 'h1' });
    expect(http.get).toHaveBeenCalledWith('/supply-room/items', { params: { houseId: 'h1' } });
  });
  it('createItem posta body', async () => {
    const body = { name: 'Sabão', unit: 'un', category: 'CLEANING', houseId: 'h1' } as never;
    await m.createItem(body);
    expect(http.post).toHaveBeenCalledWith('/supply-room/items', body);
  });
  it('updateItem patcheia', async () => {
    const body = { name: 'Sabonete' };
    await m.updateItem('it1', body);
    expect(http.patch).toHaveBeenCalledWith('/supply-room/items/it1', body);
  });
  it('deleteItem chama DELETE', async () => {
    await m.deleteItem('it1');
    expect(http.delete).toHaveBeenCalledWith('/supply-room/items/it1');
  });
  it('listMovements repassa params', async () => {
    await m.listMovements({ itemId: 'it1' });
    expect(http.get).toHaveBeenCalledWith('/supply-room/movements', { params: { itemId: 'it1' } });
  });
  it('createMovement posta body', async () => {
    const body = { itemId: 'it1', type: 'IN', quantity: 3, responsibleId: 's1', date: '2026-01-01' } as never;
    await m.createMovement(body);
    expect(http.post).toHaveBeenCalledWith('/supply-room/movements', body);
  });
});

// ── support-groups ───────────────────────────────────────────────────────────────
describe('support-groups module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createSupportGroupsModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createSupportGroupsModule(asHttp(http));
  });
  it('list busca grupos', async () => {
    await m.list();
    expect(http.get).toHaveBeenCalledWith('/support-groups');
  });
  it('create posta body', async () => {
    const body = { name: 'G1', churchName: 'Igreja', address: 'Rua', dayOfWeek: 3 };
    await m.create(body);
    expect(http.post).toHaveBeenCalledWith('/support-groups', body);
  });
  it('getById busca por id', async () => {
    await m.getById('g1');
    expect(http.get).toHaveBeenCalledWith('/support-groups/g1');
  });
  it('update patcheia', async () => {
    const body = { name: 'G2' };
    await m.update('g1', body);
    expect(http.patch).toHaveBeenCalledWith('/support-groups/g1', body);
  });
  it('delete chama DELETE', async () => {
    await m.delete('g1');
    expect(http.delete).toHaveBeenCalledWith('/support-groups/g1');
  });
  it('listAllMeetings busca todas reuniões', async () => {
    await m.listAllMeetings();
    expect(http.get).toHaveBeenCalledWith('/support-groups/meetings');
  });
  it('listMeetings busca reuniões do grupo', async () => {
    await m.listMeetings('g1');
    expect(http.get).toHaveBeenCalledWith('/support-groups/g1/meetings');
  });
  it('createMeeting posta reunião', async () => {
    const body = { date: '2026-06-01' };
    await m.createMeeting('g1', body);
    expect(http.post).toHaveBeenCalledWith('/support-groups/g1/meetings', body);
  });
  it('getMeeting busca detalhe da reunião', async () => {
    await m.getMeeting('mt1');
    expect(http.get).toHaveBeenCalledWith('/support-groups/meetings/mt1');
  });
  it('addCheckin posta checkin', async () => {
    const body = { residentId: 'r1' };
    await m.addCheckin('mt1', body);
    expect(http.post).toHaveBeenCalledWith('/support-groups/meetings/mt1/checkins', body);
  });
  it('removeCheckin chama DELETE', async () => {
    await m.removeCheckin('mt1', 'ck1');
    expect(http.delete).toHaveBeenCalledWith('/support-groups/meetings/mt1/checkins/ck1');
  });
  it('addRelativeCheckin posta checkin de familiar', async () => {
    const body = { token: 'tok' };
    await m.addRelativeCheckin(body);
    expect(http.post).toHaveBeenCalledWith('/support-groups/relative-checkin', body);
  });
  it('getMeetingRelativeCheckins busca checkins de familiares', async () => {
    await m.getMeetingRelativeCheckins('mt1');
    expect(http.get).toHaveBeenCalledWith('/support-groups/meetings/mt1/relative-checkins');
  });
  it('getRelativeCheckinHistory busca histórico do familiar', async () => {
    await m.getRelativeCheckinHistory('rel1');
    expect(http.get).toHaveBeenCalledWith('/support-groups/relatives/rel1/checkin-history');
  });
  it('getResidentCheckinHistory busca histórico do residente', async () => {
    await m.getResidentCheckinHistory('r1');
    expect(http.get).toHaveBeenCalledWith('/support-groups/residents/r1/checkin-history');
  });
});

// ── wishlist ───────────────────────────────────────────────────────────────────
describe('wishlist module', () => {
  let http: HttpMock;
  let m: ReturnType<typeof createWishlistModule>;
  beforeEach(() => {
    http = createHttpMock();
    m = createWishlistModule(asHttp(http));
  });
  it('getItems busca itens do residente', async () => {
    await m.getItems('r1');
    expect(http.get).toHaveBeenCalledWith('/wishlist/r1');
  });
  it('getPending busca pendentes', async () => {
    await m.getPending();
    expect(http.get).toHaveBeenCalledWith('/wishlist/pending');
  });
  it('addItem posta item', async () => {
    const body = { description: 'Tênis', quantity: 1 };
    await m.addItem('r1', body);
    expect(http.post).toHaveBeenCalledWith('/wishlist/r1/items', body);
  });
  it('removeItem chama DELETE e resolve undefined', async () => {
    const result = await m.removeItem('r1', 'it1');
    expect(http.delete).toHaveBeenCalledWith('/wishlist/r1/items/it1');
    expect(result).toBeUndefined();
  });
  it('approve patcheia aprovação', async () => {
    await m.approve('it1');
    expect(http.patch).toHaveBeenCalledWith('/wishlist/items/it1/approve');
  });
  it('reject sem motivo manda body vazio', async () => {
    await m.reject('it1');
    expect(http.patch).toHaveBeenCalledWith('/wishlist/items/it1/reject', {});
  });
  it('reject com motivo manda body', async () => {
    const body = { reason: 'indisponível' };
    await m.reject('it1', body);
    expect(http.patch).toHaveBeenCalledWith('/wishlist/items/it1/reject', body);
  });
});
