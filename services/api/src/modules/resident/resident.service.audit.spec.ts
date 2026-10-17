// Story 199 — cada escrita da ficha do filho grava autor, alvo, casa, resultado
// e diff corretos, na mesma transação. AuditService REAL sobre repositórios em
// memória: o antes/depois vem do estado "persistido", não do DTO.
import { ResidentStatus } from '@fonte/types';
import { ResidentService } from './resident.service';
import { Resident } from './resident.entity';
import { ResidentDocument } from './resident-document.entity';
import { ResidentAttachment } from './resident-attachment.entity';
import { Admission } from './admission.entity';
import { User } from '../user/user.entity';
import { auditContext } from '../audit/audit-context';
import { createAuditHarness, memoryRepo, repoMap } from '../audit/testing/audit-harness.testkit-spec';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as typeof import('sharp');

const R1 = 'r1';

function setup(initial: Record<string, unknown> = {}) {
  const residents = memoryRepo([
    {
      id: R1,
      name: 'Ana',
      cpf: '12345678900',
      status: ResidentStatus.ACTIVE,
      houseId: 'h1',
      ministryId: null,
      entryDate: '2024-01-10',
      exitDate: null,
      birthDate: '1990-01-01',
      healthIssues: 'asma',
      familyInvestment: 'SOCIAL',
      contributionExempt: false,
      photoUrl: null,
      ...initial,
    },
  ]);
  const docs = memoryRepo();
  const attachments = memoryRepo();
  const admissionQb = {
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    addOrderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    getOne: jest.fn().mockResolvedValue(null),
  };
  const admissions = { ...memoryRepo(), createQueryBuilder: jest.fn(() => admissionQb) };
  const harness = createAuditHarness(
    repoMap([
      [Resident, residents],
      [ResidentDocument, docs],
      [ResidentAttachment, attachments],
      [Admission, admissions],
      [User, memoryRepo()],
    ]),
  );
  const storage = {
    upload: jest.fn().mockResolvedValue('https://bucket/residents/x.jpg'),
    delete: jest.fn().mockResolvedValue(undefined),
    uniqueFilename: jest.fn((n: string) => `u-${n}`),
    decodeOriginalName: jest.fn((n: string) => n),
  };
  const service = new ResidentService(
    residents as never,
    docs as never,
    attachments as never,
    memoryRepo() as never,
    admissions as never,
    storage as never,
    {
      createAuto: jest.fn().mockResolvedValue(undefined),
      getLastContributionDates: jest.fn().mockResolvedValue(new Map()),
    } as never,
    {
      generateSchedule: jest.fn(),
      recalcFuturePending: jest.fn(),
      cancelFuturePending: jest.fn(),
      cancelAfterExit: jest.fn(),
    } as never,
    {} as never,
    { query: jest.fn().mockResolvedValue([]) } as never,
    { create: jest.fn().mockResolvedValue(undefined) } as never,
    harness.audit,
  );
  const ctx = {
    requestId: 'req-9',
    userId: 'admin-1',
    role: 'ADMIN',
    ipAddress: '10.1.1.1',
    httpMethod: 'PATCH',
    path: '/api/v1/residents/r1',
  };
  const asAdmin = <T>(fn: () => Promise<T>) => auditContext.run({ ...ctx }, fn);
  return { service, harness, residents, docs, attachments, storage, asAdmin };
}

describe('ResidentService — auditoria (story 199)', () => {
  it('criação: before null, autor do contexto, casa, CPF mascarado e saúde protegida', async () => {
    const s = setup();
    await s.asAdmin(() =>
      s.service.create({
        name: 'Bruno',
        cpf: '98765432100',
        houseId: 'h1',
        status: ResidentStatus.PRE_ADMISSION,
        healthIssues: 'diabetes',
      } as never),
    );
    const [event] = s.harness.inserted;
    expect(event).toMatchObject({
      action: 'resident.create',
      targetType: 'resident',
      userId: 'admin-1',
      role: 'ADMIN',
      houseId: 'h1',
      outcome: 'SUCCESS',
      correlationId: 'req-9',
    });
    const changes = event.changes as Array<{ field: string; before: unknown; after: unknown }>;
    expect(changes.every((c) => c.before === null)).toBe(true);
    expect(changes.find((c) => c.field === 'cpf')).toEqual({ field: 'cpf', before: null, after: '***00', redacted: true });
    expect(changes.find((c) => c.field === 'healthIssues')).toEqual({
      field: 'healthIssues',
      before: null,
      after: null,
      redacted: true,
    });
    expect(JSON.stringify(event)).not.toMatch(/diabetes|98765432100/);
  });

  it('edição com transferência: só campos alterados, casa nova e anterior', async () => {
    const s = setup();
    await s.asAdmin(() => s.service.update(R1, { name: 'Ana Maria', houseId: 'h2' } as never));
    expect(s.harness.inserted).toEqual([
      expect.objectContaining({
        action: 'resident.update',
        targetId: R1,
        houseId: 'h2',
        previousHouseId: 'h1',
        changedFields: ['name', 'houseId'],
        changes: [
          { field: 'name', before: 'Ana', after: 'Ana Maria', redacted: false },
          { field: 'houseId', before: 'h1', after: 'h2', redacted: false },
        ],
      }),
    ]);
  });

  it('edição sem mudança efetiva (no-op) não gera evento', async () => {
    const s = setup();
    await s.asAdmin(() => s.service.update(R1, { name: 'Ana' } as never));
    expect(s.harness.inserted).toHaveLength(0);
  });

  it('erro de negócio (transição recusada) não grava evento', async () => {
    const s = setup({ status: ResidentStatus.EVADED });
    await expect(s.service.update(R1, { status: ResidentStatus.DISCHARGED } as never)).rejects.toThrow();
    expect(s.harness.inserted).toHaveLength(0);
  });

  it('identidade, plano, isenção e exclusão gravam a própria ação', async () => {
    const s = setup();
    await s.service.updateIdentity(R1, { name: 'Ana Souza' } as never);
    await s.service.updateContributionPlan(R1, { familyInvestment: 'BASKET_500' } as never);
    await s.service.setContributionExempt(R1, true);
    await s.service.remove(R1).catch(() => undefined);
    const actions = s.harness.inserted.map((e) => [e.action, e.changedFields]);
    expect(actions).toEqual([
      ['resident.identity.update', ['name']],
      ['resident.contribution_plan.update', ['familyInvestment', 'familyInvestmentAmount']],
      ['resident.contribution_exempt.update', ['contributionExempt']],
      ['resident.delete', ['status', 'houseId', 'entryDate']],
    ]);
    // Exclusão: after null e nada da ficha além do vínculo.
    const deletion = s.harness.inserted[3];
    expect(deletion).toMatchObject({ houseId: 'h1' });
    expect((deletion.changes as Array<{ after: unknown }>).every((c) => c.after === null)).toBe(true);
  });

  it('reacolhimento registra a volta para ACTIVE na casa nova', async () => {
    const s = setup({ status: ResidentStatus.DISCHARGED, exitDate: '2024-05-01' });
    await s.service.readmit(R1, { houseId: 'h3', entryDate: '2024-06-01' } as never);
    expect(s.harness.inserted[0]).toMatchObject({
      action: 'resident.readmit',
      houseId: 'h3',
      previousHouseId: 'h1',
    });
    expect(s.harness.inserted[0].changedFields).toEqual(
      expect.arrayContaining(['status', 'houseId', 'entryDate', 'exitDate']),
    );
  });

  it('foto: marcador de arquivo, nunca a URL', async () => {
    const s = setup();
    const buffer = await sharp({ create: { width: 4, height: 4, channels: 3, background: '#f00' } })
      .png()
      .toBuffer();
    await s.service.uploadPhoto(R1, { originalname: 'a.png', buffer, mimetype: 'image/png' } as never);
    expect(s.harness.inserted[0]).toMatchObject({
      action: 'resident.photo.update',
      changes: [{ field: 'photoUrl', before: null, after: '[arquivo]', redacted: false }],
    });
    expect(JSON.stringify(s.harness.inserted)).not.toContain('bucket');
  });

  it('anexo adicionado/removido e documento assinado: filho como recurso principal, sem nome do arquivo', async () => {
    const s = setup();
    const file = { originalname: 'RG Ana.pdf', buffer: Buffer.from('x'), mimetype: 'application/pdf' };
    const attachment = await s.service.addAttachment(R1, file as never, 'RG Ana.pdf');
    await s.service.removeAttachment(R1, attachment.id);
    await s.service.uploadSignedDocument(R1, 'tpl-1', file as never);

    expect(s.harness.inserted.map((e) => e.action)).toEqual([
      'resident.attachment.add',
      'resident.attachment.remove',
      'resident.document.signed',
    ]);
    for (const e of s.harness.inserted) {
      expect(e).toMatchObject({ parentType: 'resident', parentId: R1 });
    }
    expect(s.harness.inserted[2]).toMatchObject({ targetType: 'resident-document' });
    expect(JSON.stringify(s.harness.inserted)).not.toContain('RG Ana');
  });
});
