import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { ResidentStatus, Role, ServantRank, TemplateAvailability } from '@fonte/types';
import { ResidentService } from './resident.service';
import { Resident } from './resident.entity';
import { ResidentDocument } from './resident-document.entity';
import { ResidentAttachment } from './resident-attachment.entity';
import { Admission } from './admission.entity';
import { User } from '../user/user.entity';

jest.mock('bcrypt', () => ({ hash: jest.fn().mockResolvedValue('hashed') }));

type Mocks = {
  resident: Record<string, jest.Mock>;
  doc: Record<string, jest.Mock>;
  attachment: Record<string, jest.Mock>;
  user: Record<string, jest.Mock>;
  storage: Record<string, jest.Mock>;
  followUp: Record<string, jest.Mock>;
  receivable: Record<string, jest.Mock>;
  staff: Record<string, jest.Mock>;
};

function build(over: Partial<Record<keyof Mocks, Record<string, jest.Mock>>> = {}) {
  const mocks: Mocks = {
    resident: {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      softDelete: jest.fn().mockResolvedValue({ affected: 1 }),
      ...over.resident,
    },
    doc: {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'doc-1', ...v })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      ...over.doc,
    },
    attachment: {
      findOne: jest.fn().mockResolvedValue(null),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'att-1', ...v })),
      delete: jest.fn().mockResolvedValue({ affected: 1 }),
      ...over.attachment,
    },
    user: {
      findOne: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockImplementation((v) => v),
      save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'user-1', ...v })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      ...over.user,
    },
    storage: {
      upload: jest.fn().mockResolvedValue('http://x/file.jpg'),
      delete: jest.fn().mockResolvedValue(undefined),
      uniqueFilename: jest.fn().mockImplementation((n: string) => `u-${n}`),
      decodeOriginalName: jest.fn().mockImplementation((n: string) => n),
      ...over.storage,
    },
    followUp: {
      createAuto: jest.fn().mockResolvedValue(undefined),
      getLastContributionDates: jest.fn().mockResolvedValue(new Map()),
      ...over.followUp,
    },
    receivable: {
      generateSchedule: jest.fn().mockResolvedValue(undefined),
      recalcFuturePending: jest.fn().mockResolvedValue(undefined),
      cancelFuturePending: jest.fn().mockResolvedValue(undefined),
      getLastPaidDates: jest.fn().mockResolvedValue(new Map()),
      ...over.receivable,
    },
    staff: {
      existsForFormerResident: jest.fn().mockResolvedValue(false),
      createFromResident: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      findOne: jest.fn().mockResolvedValue({ id: 'staff-1' }),
      ...over.staff,
    },
  };

  const service = new ResidentService(
    mocks.resident as unknown as Repository<Resident>,
    mocks.doc as unknown as Repository<ResidentDocument>,
    mocks.attachment as unknown as Repository<ResidentAttachment>,
    mocks.user as unknown as Repository<User>,
    {} as Repository<Admission>,
    mocks.storage as never,
    mocks.followUp as never,
    mocks.receivable as never,
    mocks.staff as never,
    { query: jest.fn().mockResolvedValue([]) } as never,
    { create: jest.fn() } as never,
  );
  return { service, mocks };
}

const file = { buffer: Buffer.from('x'), originalname: 'a.jpg', mimetype: 'image/jpeg' } as Express.Multer.File;

// Valid 1x1 PNG so sharp can produce a thumbnail in uploadPhoto.
const PNG_1x1 = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M8AAAMBAQDJ/pLvAAAAAElFTkSuQmCC',
  'base64',
);
const imageFile = { buffer: PNG_1x1, originalname: 'a.png', mimetype: 'image/png' } as Express.Multer.File;

describe('ResidentService.generateAccess', () => {
  it('throws Conflict when access already exists', async () => {
    const { service } = build({ resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1', userId: 'u-existing' }) } });
    await expect(service.generateAccess('r1', 'a@b.com', 'pw')).rejects.toBeInstanceOf(ConflictException);
  });

  it('throws Conflict when email is taken', async () => {
    const { service } = build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1', userId: null }) },
      user: { findOne: jest.fn().mockResolvedValue({ id: 'other' }) },
    });
    await expect(service.generateAccess('r1', 'a@b.com', 'pw')).rejects.toBeInstanceOf(ConflictException);
  });

  it('creates a RESIDENT user and links it', async () => {
    const { service, mocks } = build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1', userId: null }) },
    });
    await service.generateAccess('r1', 'a@b.com', 'pw');
    expect(mocks.user.create.mock.calls[0][0].role).toBe(Role.RESIDENT);
    expect(mocks.resident.update).toHaveBeenCalledWith('r1', { userId: 'user-1' });
  });
});

describe('ResidentService.resetPassword', () => {
  it('throws NotFound when resident missing', async () => {
    const { service } = build({ resident: { findOne: jest.fn().mockResolvedValue(null) } });
    await expect(service.resetPassword('r1', 'pw')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('throws NotFound when access not generated', async () => {
    const { service } = build({ resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1', userId: null, user: null }) } });
    await expect(service.resetPassword('r1', 'pw')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('updates the user password and forces change', async () => {
    const { service, mocks } = build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1', userId: 'u1', user: { id: 'u1' } }) },
    });
    await service.resetPassword('r1', 'pw');
    expect(mocks.user.update).toHaveBeenCalledWith('u1', { passwordHash: 'hashed', mustChangePassword: true });
  });
});

describe('ResidentService.promoteToServant', () => {
  it('throws Conflict when already promoted', async () => {
    const { service } = build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1' }) },
      staff: { existsForFormerResident: jest.fn().mockResolvedValue(true), findOne: jest.fn() },
    });
    await expect(service.promoteToServant('r1', {} as never)).rejects.toBeInstanceOf(ConflictException);
  });

  it('requires a password when no kiosk account exists', async () => {
    const { service } = build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1', userId: null }) },
    });
    await expect(service.promoteToServant('r1', {} as never)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('reuses the kiosk user, archives the resident and returns the staff', async () => {
    const { service, mocks } = build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1', userId: 'u1', name: 'Ana', houseId: 'h1', contactPhone: '9', photoUrl: null }) },
    });
    const out = await service.promoteToServant('r1', { rank: ServantRank.ASPIRANTE } as never);
    expect(mocks.user.update).toHaveBeenCalledWith('u1', { role: Role.SERVANT });
    expect(mocks.staff.createFromResident).toHaveBeenCalled();
    expect(out).toEqual({ id: 'staff-1' });
  });

  it('creates a new servant account when no kiosk user', async () => {
    const { service, mocks } = build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1', userId: null, name: 'Ana', houseId: 'h1', contactPhone: '9', photoUrl: null }) },
    });
    await service.promoteToServant('r1', { password: 'pw', email: 'a@b.com' } as never);
    expect(mocks.user.save).toHaveBeenCalled();
    expect(mocks.user.create.mock.calls[0][0].role).toBe(Role.SERVANT);
  });
});

describe('ResidentService.updateContributionPlan / setContributionExempt', () => {
  it('recalculates pending after updating the plan', async () => {
    const { service, mocks } = build({ resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1' }) } });
    await service.updateContributionPlan('r1', { familyInvestment: 'BASKET_500' } as never);
    expect(mocks.receivable.recalcFuturePending).toHaveBeenCalledWith('r1');
  });

  it('cancels future pending when exempting', async () => {
    const { service, mocks } = build({ resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1' }) } });
    await service.setContributionExempt('r1', true);
    expect(mocks.receivable.cancelFuturePending).toHaveBeenCalledWith('r1');
  });

  it('regenerates schedule when removing the exemption', async () => {
    const { service, mocks } = build({ resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1' }) } });
    await service.setContributionExempt('r1', false);
    expect(mocks.receivable.generateSchedule).toHaveBeenCalledWith('r1');
  });
});

describe('ResidentService.findMe / uploadPhotoMe', () => {
  it('throws NotFound when no resident profile for the user', async () => {
    const { service } = build({ resident: { findOne: jest.fn().mockResolvedValue(null) } });
    await expect(service.findMe('u1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('returns the me view', async () => {
    const { service } = build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1', name: 'Ana', houseId: 'h1', userId: 'u1', photoUrl: null, photoThumbUrl: null }) },
    });
    const out = await service.findMe('u1');
    expect(out).toMatchObject({ id: 'r1', name: 'Ana', userId: 'u1' });
  });

  it('uploadPhotoMe throws NotFound for an unknown user', async () => {
    const { service } = build({ resident: { findOne: jest.fn().mockResolvedValue(null) } });
    await expect(service.uploadPhotoMe('u1', file)).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('ResidentService.uploadPhoto', () => {
  it('deletes old photos, uploads new + thumbnail and updates urls', async () => {
    const { service, mocks } = build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1', photoUrl: 'old.jpg', photoThumbUrl: 'oldthumb.jpg' }) },
    });
    await service.uploadPhoto('r1', imageFile);
    expect(mocks.storage.delete).toHaveBeenCalledWith('old.jpg');
    expect(mocks.storage.delete).toHaveBeenCalledWith('oldthumb.jpg');
    expect(mocks.storage.upload).toHaveBeenCalledTimes(2);
    expect(mocks.resident.update).toHaveBeenCalledWith('r1', expect.objectContaining({ photoUrl: expect.any(String), photoThumbUrl: expect.any(String) }));
  });
});

describe('ResidentService.findDocuments', () => {
  it('flags signed docs within the signing window', async () => {
    const { service } = build({
      doc: {
        find: jest.fn().mockResolvedValue([
          { id: 'd1', residentId: 'r1', templateId: 't1', template: { name: 'Termo', signAtAdmission: true }, signedFileUrl: 'f.pdf', updatedAt: new Date() },
          { id: 'd2', residentId: 'r1', templateId: 't2', template: { name: 'Outro', signAtAdmission: false }, signedFileUrl: null, updatedAt: new Date(0) },
        ]),
      },
    });
    const out = await service.findDocuments('r1');
    expect(out[0].signed).toBe(true);
    expect(out[0].withinWindow).toBe(true);
    expect(out[1].signed).toBe(false);
    expect(out[1].withinWindow).toBe(false);
  });
});

describe('ResidentService.findAdmissionDocuments', () => {
  it('maps templates to signing status with pdf path', async () => {
    const { service } = build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1' }) },
      doc: { find: jest.fn().mockResolvedValue([{ templateId: 't1', signedFileUrl: 'f.pdf', updatedAt: new Date() }]) },
    });
    const out = await service.findAdmissionDocuments('r1', [{ id: 't1', name: 'Termo' }, { id: 't2', name: 'Outro' }]);
    expect(out[0].signed).toBe(true);
    expect(out[0].pdfPath).toContain('/residents/r1/documents/t1/pdf');
    expect(out[1].signed).toBe(false);
  });
});

// ─── Disponibilidade do template por status do filho (story 160) ─────────────
//
// A guarda do backend recusa GERAR; estas duas listagens é que impedem o
// documento indisponível de sequer aparecer na aba de anexos — a aba se alimenta
// das DUAS fontes, então filtrar só numa deixaria o card órfão na tela.

describe('ResidentService.findDocuments — filtro por disponibilidade (story 160)', () => {
  function buildWithDocs(status: ResidentStatus) {
    return build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1', status }) },
      doc: {
        find: jest.fn().mockResolvedValue([
          { id: 'd1', residentId: 'r1', templateId: 't1', template: { name: 'Ficha', availableFor: TemplateAvailability.ACTIVE_ONLY }, signedFileUrl: null, updatedAt: new Date() },
          { id: 'd2', residentId: 'r1', templateId: 't2', template: { name: 'Alta', availableFor: TemplateAvailability.INACTIVE_ONLY }, signedFileUrl: null, updatedAt: new Date() },
          { id: 'd3', residentId: 'r1', templateId: 't3', template: { name: 'Sempre', availableFor: TemplateAvailability.ALL }, signedFileUrl: null, updatedAt: new Date() },
        ]),
      },
    });
  }

  it('filho ativo vê o ACTIVE_ONLY e o ALL, nunca o INACTIVE_ONLY', async () => {
    const { service } = buildWithDocs(ResidentStatus.ACTIVE);
    const out = await service.findDocuments('r1');
    expect(out.map((d) => d.templateName)).toEqual(['Ficha', 'Sempre']);
  });

  it('filho em alta vê o INACTIVE_ONLY e o ALL, nunca o ACTIVE_ONLY', async () => {
    const { service } = buildWithDocs(ResidentStatus.DISCHARGED);
    const out = await service.findDocuments('r1');
    expect(out.map((d) => d.templateName)).toEqual(['Alta', 'Sempre']);
  });

  it('PRE_ADMISSION conta como ativo (decisão 3 da story)', async () => {
    const { service } = buildWithDocs(ResidentStatus.PRE_ADMISSION);
    const out = await service.findDocuments('r1');
    expect(out.map((d) => d.templateName)).toEqual(['Ficha', 'Sempre']);
  });
});

describe('ResidentService.findAdmissionDocuments — filtro por disponibilidade (story 160)', () => {
  const templates = [
    { id: 't1', name: 'Ficha', availableFor: TemplateAvailability.ACTIVE_ONLY },
    { id: 't2', name: 'Alta', availableFor: TemplateAvailability.INACTIVE_ONLY },
    { id: 't3', name: 'Sempre', availableFor: TemplateAvailability.ALL },
  ];

  function buildFor(status: ResidentStatus) {
    return build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1', status }) },
      doc: { find: jest.fn().mockResolvedValue([]) },
    });
  }

  it('filho ativo não recebe o documento de desligamento', async () => {
    const { service } = buildFor(ResidentStatus.TEMP_LEAVE);
    const out = await service.findAdmissionDocuments('r1', templates);
    expect(out.map((d) => d.templateName)).toEqual(['Ficha', 'Sempre']);
  });

  it('filho evadido não recebe o documento de acolhimento', async () => {
    const { service } = buildFor(ResidentStatus.EVADED);
    const out = await service.findAdmissionDocuments('r1', templates);
    expect(out.map((d) => d.templateName)).toEqual(['Alta', 'Sempre']);
  });
});

describe('ResidentService.uploadSignedDocument', () => {
  it('creates a new document when none exists', async () => {
    const { service, mocks } = build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1' }) },
      doc: { findOne: jest.fn().mockResolvedValue(null) },
    });
    await service.uploadSignedDocument('r1', 't1', { ...file, originalname: 's.pdf', mimetype: 'application/pdf' } as Express.Multer.File);
    expect(mocks.doc.create).toHaveBeenCalled();
    expect(mocks.doc.save).toHaveBeenCalled();
  });

  it('replaces an existing signed file', async () => {
    const { service, mocks } = build({
      resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1' }) },
      doc: {
        findOne: jest
          .fn()
          .mockResolvedValueOnce({ id: 'd1', signedFileUrl: 'old.pdf' })
          .mockResolvedValueOnce({ id: 'd1', signedFileUrl: 'http://x/file.jpg' }),
      },
    });
    await service.uploadSignedDocument('r1', 't1', { ...file, originalname: 's.pdf', mimetype: 'application/pdf' } as Express.Multer.File);
    expect(mocks.storage.delete).toHaveBeenCalledWith('old.pdf');
    expect(mocks.doc.update).toHaveBeenCalled();
  });
});

describe('ResidentService.attachments', () => {
  it('addAttachment uploads, saves and records a follow-up', async () => {
    const { service, mocks } = build({ resident: { findOne: jest.fn().mockResolvedValue({ id: 'r1' }) } });
    await service.addAttachment('r1', file, 'orig.pdf');
    expect(mocks.storage.upload).toHaveBeenCalled();
    expect(mocks.attachment.save).toHaveBeenCalled();
    expect(mocks.followUp.createAuto).toHaveBeenCalled();
  });

  it('removeAttachment throws NotFound when missing', async () => {
    const { service } = build({ attachment: { findOne: jest.fn().mockResolvedValue(null) } });
    await expect(service.removeAttachment('r1', 'a1')).rejects.toBeInstanceOf(NotFoundException);
  });

  it('removeAttachment deletes storage and row', async () => {
    const { service, mocks } = build({
      attachment: { findOne: jest.fn().mockResolvedValue({ id: 'a1', fileUrl: 'f.pdf' }) },
    });
    await service.removeAttachment('r1', 'a1');
    expect(mocks.storage.delete).toHaveBeenCalledWith('f.pdf');
    expect(mocks.attachment.delete).toHaveBeenCalledWith('a1');
  });

  it('findAttachments queries by resident', async () => {
    const { service, mocks } = build();
    await service.findAttachments('r1');
    expect(mocks.attachment.find).toHaveBeenCalledWith({ where: { residentId: 'r1' }, order: { createdAt: 'DESC' } });
  });
});

// ─── Snapshot offline da casa (story 177) ────────────────────────────────────

function makeQb(rows: unknown[] = []) {
  const qb: Record<string, jest.Mock> = {
    select: jest.fn().mockReturnThis(),
    leftJoinAndSelect: jest.fn().mockReturnThis(),
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    withDeleted: jest.fn().mockReturnThis(),
    getMany: jest.fn().mockResolvedValue(rows),
    getRawMany: jest.fn().mockResolvedValue(rows),
  };
  return qb;
}

const PRESENT = [ResidentStatus.ACTIVE, ResidentStatus.DISCIPLINE, ResidentStatus.TEMP_LEAVE];

describe('ResidentService.findPresentByHouse (story 177)', () => {
  it('restringe aos status presentes e à casa, sem filtro de data quando full', async () => {
    const qb = makeQb([{ id: 'r1' }]);
    const { service } = build({ resident: { createQueryBuilder: jest.fn().mockReturnValue(qb) } });

    const result = await service.findPresentByHouse('house-1');

    expect(result).toEqual([{ id: 'r1' }]);
    expect(qb.where).toHaveBeenCalledWith('resident.house_id = :houseId', { houseId: 'house-1' });
    expect(qb.andWhere).toHaveBeenCalledWith('resident.status IN (:...statuses)', {
      statuses: PRESENT,
    });
    // Filho fora de PRESENT_RESIDENT_STATUSES (alta/evasão/arquivado) não desce.
    expect(qb.andWhere).not.toHaveBeenCalledWith(
      'resident.updated_at > :since',
      expect.anything(),
    );
  });

  it('recorta por updated_at quando o delta traz since', async () => {
    const qb = makeQb();
    const { service } = build({ resident: { createQueryBuilder: jest.fn().mockReturnValue(qb) } });
    const since = new Date('2026-08-01T00:00:00.000Z');

    await service.findPresentByHouse('house-1', since);

    // Literal em UTC: a coluna é `timestamp` sem fuso (ver toDbTimestamp).
    expect(qb.andWhere).toHaveBeenCalledWith('resident.updated_at > :since', {
      since: '2026-08-01 00:00:00.000',
    });
    // O filtro de status vale no delta também.
    expect(qb.andWhere).toHaveBeenCalledWith('resident.status IN (:...statuses)', {
      statuses: PRESENT,
    });
  });

  it('não traz a conta de acesso do filho (sem relação user)', async () => {
    const qb = makeQb();
    const { service } = build({ resident: { createQueryBuilder: jest.fn().mockReturnValue(qb) } });

    await service.findPresentByHouse('house-1');

    const joined = qb.leftJoinAndSelect.mock.calls.map((call) => call[0]);
    // Story 197: `resident.ministry` deixou de existir — o filho não tem mais
    // vínculo com ministério, então o join sumiu junto com a coluna.
    expect(joined).toEqual(['resident.house']);
  });
});

describe('ResidentService.findPresentIdsByHouse (story 177)', () => {
  it('devolve só os ids dos presentes da casa', async () => {
    const qb = makeQb([{ id: 'r1' }, { id: 'r2' }]);
    const { service } = build({ resident: { createQueryBuilder: jest.fn().mockReturnValue(qb) } });

    expect(await service.findPresentIdsByHouse('house-1')).toEqual(['r1', 'r2']);
    expect(qb.select).toHaveBeenCalledWith('resident.id', 'id');
    expect(qb.andWhere).toHaveBeenCalledWith('resident.status IN (:...statuses)', {
      statuses: PRESENT,
    });
  });
});

describe('ResidentService.findDepartedIdsSince (story 177)', () => {
  it('inclui excluídos e quem deixou os status presentes', async () => {
    const qb = makeQb([{ id: 'saiu' }]);
    const { service } = build({ resident: { createQueryBuilder: jest.fn().mockReturnValue(qb) } });
    const since = new Date('2026-08-01T00:00:00.000Z');

    expect(await service.findDepartedIdsSince('house-1', since)).toEqual(['saiu']);
    expect(qb.withDeleted).toHaveBeenCalled();
    const [sql, params] = qb.andWhere.mock.calls[0];
    expect(sql).toContain('resident.deleted_at > :since');
    expect(sql).toContain('resident.status NOT IN (:...statuses)');
    expect(params).toEqual({ since: '2026-08-01 00:00:00.000', statuses: PRESENT });
  });
});

describe('ResidentService.findAttachmentsByResidents (story 177)', () => {
  it('não vai ao banco com lista vazia', async () => {
    const { service, mocks } = build();
    expect(await service.findAttachmentsByResidents([])).toEqual([]);
    expect(mocks.attachment.find).not.toHaveBeenCalled();
  });

  it('busca os anexos de N filhos numa consulta só', async () => {
    const { service, mocks } = build({
      attachment: { find: jest.fn().mockResolvedValue([{ id: 'a1', residentId: 'r1' }]) },
    });

    const result = await service.findAttachmentsByResidents(['r1', 'r2']);

    expect(result).toEqual([{ id: 'a1', residentId: 'r1' }]);
    expect(mocks.attachment.find).toHaveBeenCalledTimes(1);
    const where = mocks.attachment.find.mock.calls[0][0].where.residentId;
    expect(where._value).toEqual(['r1', 'r2']);
  });
});
