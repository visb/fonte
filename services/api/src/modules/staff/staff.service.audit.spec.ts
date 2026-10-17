// Story 199 — escritas de servos (ficha, perfil próprio, foto, assinatura,
// permissões, anexos, vínculo com casa) com antes/depois na mesma transação.
jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed') }));

import { StaffService } from './staff.service';
import { StaffAttachmentService } from './staff-attachment.service';
import { Staff } from './staff.entity';
import { StaffPermission } from './staff-permission.entity';
import { StaffAttachment } from './staff-attachment.entity';
import { User } from '../user/user.entity';
import { createAuditHarness, memoryRepo, repoMap } from '../audit/testing/audit-harness.testkit-spec';

function setup() {
  const staff = memoryRepo([
    {
      id: 's1',
      name: 'Servo',
      whatsapp: '11999990000',
      houseId: 'h1',
      userId: 'u1',
      photoUrl: null,
      signatureUrl: 'https://bucket/sig.png',
      cpf: '12345678900',
    },
  ]);
  const users = memoryRepo([
    { id: 'u1', email: 'servo@fonte.com', role: 'SERVANT', isActive: true, passwordHash: 'old-hash' },
  ]);
  const permissions = memoryRepo();
  const attachments = memoryRepo();
  const houseCount = jest.fn().mockResolvedValue(0);
  const harness = createAuditHarness(
    repoMap([
      [Staff, staff],
      [User, users],
      [StaffPermission, permissions],
      [StaffAttachment, attachments],
    ]),
    undefined,
    { count: houseCount, update: jest.fn() },
  );
  const storage = {
    upload: jest.fn().mockResolvedValue('https://bucket/new.png'),
    delete: jest.fn().mockResolvedValue(undefined),
    uniqueFilename: jest.fn((n: string) => `u-${n}`),
    decodeOriginalName: jest.fn((n: string) => n),
  };
  const service = new StaffService(
    staff as never,
    users as never,
    permissions as never,
    storage as never,
    harness.audit,
  );
  const attachmentService = new StaffAttachmentService(
    attachments as never,
    { exists: jest.fn().mockResolvedValue(true) } as never,
    storage as never,
    harness.audit,
  );
  return { service, attachmentService, harness, staff, users };
}

describe('StaffService — auditoria (story 199)', () => {
  it('criação grava User+Staff+evento juntos, sem senha/hash', async () => {
    const s = setup();
    await s.service.create({
      name: 'Novo',
      email: 'novo@fonte.com',
      password: 'segredo123',
      role: 'SERVANT',
      houseId: 'h1',
    } as never);
    const [event] = s.harness.inserted;
    expect(event).toMatchObject({ action: 'staff.create', targetType: 'staff', houseId: 'h1' });
    expect(event.changedFields).toEqual(expect.arrayContaining(['name', 'houseId', 'email', 'role']));
    expect(JSON.stringify(event)).not.toMatch(/segredo|hashed|novo@fonte/);
    expect(s.harness.dataSource.transaction).toHaveBeenCalledTimes(1);
  });

  it('edição: troca de casa e de perfil (User) no mesmo evento; senha só reseta, não aparece', async () => {
    const s = setup();
    await s.service.update('s1', { houseId: 'h2', role: 'COORDINATOR', password: 'nova123' } as never);
    expect(s.harness.inserted).toEqual([
      expect.objectContaining({
        action: 'staff.update',
        targetId: 's1',
        houseId: 'h2',
        previousHouseId: 'h1',
        changedFields: ['houseId', 'role'],
      }),
    ]);
    expect(JSON.stringify(s.harness.inserted)).not.toMatch(/nova123|hashed/);
  });

  it('perfil próprio, foto, assinatura (troca e remoção)', async () => {
    const s = setup();
    await s.service.updateMe('u1', { name: 'Servo Bom' } as never);
    await s.service.uploadPhoto('s1', { originalname: 'f.png', buffer: Buffer.from('x'), mimetype: 'image/png' } as never);
    await s.service.uploadSignature('s1', { originalname: 's.png', buffer: Buffer.from('x'), mimetype: 'image/png' } as never);
    await s.service.removeSignature('s1');
    expect(s.harness.inserted.map((e) => [e.action, e.changedFields])).toEqual([
      ['staff.self_update', ['name']],
      ['staff.photo.update', ['photoUrl']],
      ['staff.signature.update', ['signatureUrl']],
      ['staff.signature.remove', ['signatureUrl']],
    ]);
    expect(JSON.stringify(s.harness.inserted)).not.toContain('bucket');
  });

  it('remoção registra só o vínculo (casa/perfil/ativo) e after null', async () => {
    const s = setup();
    await s.service.remove('s1');
    expect(s.harness.inserted[0]).toMatchObject({
      action: 'staff.delete',
      houseId: 'h1',
      changedFields: ['houseId', 'role', 'isActive'],
    });
  });

  it('permissão concedida e revogada: servo como recurso principal', async () => {
    const s = setup();
    await s.service.addPermission('s1', 'MANAGE_STOREROOM' as never);
    await s.service.removePermission('s1', 'MANAGE_STOREROOM' as never);
    expect(s.harness.inserted).toEqual([
      expect.objectContaining({
        action: 'staff.permission.grant',
        targetType: 'staff-permission',
        parentType: 'staff',
        parentId: 's1',
        changes: [
          { field: 'staffId', before: null, after: 's1', redacted: false },
          { field: 'permissionType', before: null, after: 'MANAGE_STOREROOM', redacted: false },
        ],
      }),
      expect.objectContaining({ action: 'staff.permission.revoke', parentId: 's1' }),
    ]);
  });

  it('anexo do servo: tipo e tamanho, nunca nome nem URL', async () => {
    const s = setup();
    const saved = await s.attachmentService.addAttachment(
      's1',
      { originalname: 'Contrato Fulano.pdf', mimetype: 'application/pdf', size: 99, buffer: Buffer.from('x') } as never,
      'u-admin',
    );
    await s.attachmentService.removeAttachment('s1', saved.id);
    expect(s.harness.inserted.map((e) => e.action)).toEqual(['staff.attachment.add', 'staff.attachment.remove']);
    expect(s.harness.inserted[0].changes).toEqual([
      { field: 'staffId', before: null, after: 's1', redacted: false },
      { field: 'mimeType', before: null, after: 'application/pdf', redacted: false },
      { field: 'sizeBytes', before: null, after: 99, redacted: false },
      { field: 'fileUrl', before: null, after: '[arquivo]', redacted: false },
    ]);
    expect(JSON.stringify(s.harness.inserted)).not.toMatch(/Fulano|bucket/);
  });
});
