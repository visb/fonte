import { ConflictException, NotFoundException } from '@nestjs/common';
import { Repository } from 'typeorm';
import { DocumentTemplateService } from './document-template.service';
import { DocumentTemplate } from './document-template.entity';
import { Relative } from '../relative/relative.entity';
import { Resident } from '../resident/resident.entity';
import { StorageService } from '../storage/storage.service';

function makeRepo(overrides: Record<string, jest.Mock> = {}) {
  return {
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockImplementation((v) => v),
    save: jest.fn().mockImplementation((v) => Promise.resolve({ id: 'tpl-1', ...v })),
    update: jest.fn().mockResolvedValue({ affected: 1 }),
    delete: jest.fn().mockResolvedValue({ affected: 1 }),
    ...overrides,
  };
}

function makeService(repo: ReturnType<typeof makeRepo>, relativeRepo = makeRepo()) {
  return new DocumentTemplateService(
    repo as unknown as Repository<DocumentTemplate>,
    relativeRepo as unknown as Repository<Relative>,
    {} as StorageService,
  );
}

describe('DocumentTemplateService.findOne', () => {
  it('throws NotFound when missing', async () => {
    const service = makeService(makeRepo());
    await expect(service.findOne('nope')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DocumentTemplateService.create', () => {
  it('rejects a duplicate name', async () => {
    const repo = makeRepo({ findOne: jest.fn().mockResolvedValue({ id: 'tpl-1' }) });
    const service = makeService(repo);
    await expect(service.create('Termo', '<p></p>')).rejects.toBeInstanceOf(ConflictException);
  });

  it('persists a new template', async () => {
    const repo = makeRepo();
    const service = makeService(repo);
    await service.create('Termo', '<p>hi</p>', true);
    expect(repo.save).toHaveBeenCalled();
    expect(repo.create.mock.calls[0][0]).toMatchObject({ name: 'Termo', isRequired: true });
  });
});

describe('DocumentTemplateService.update', () => {
  it('rejects renaming to an existing template name', async () => {
    const repo = makeRepo({
      findOne: jest
        .fn()
        .mockResolvedValueOnce({ id: 'tpl-1' }) // findOne(id) in update
        .mockResolvedValueOnce({ id: 'tpl-2' }), // name conflict
    });
    const service = makeService(repo);
    await expect(service.update('tpl-1', { name: 'Outro' })).rejects.toBeInstanceOf(ConflictException);
  });
});

describe('DocumentTemplateService.renderForResident', () => {
  it('substitutes resident variables in the template content', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: 'Eu, {{name}}, CPF {{cpf}}.' }),
    });
    const relativeRepo = makeRepo({ findOne: jest.fn().mockResolvedValue(null) });
    const service = makeService(repo, relativeRepo);

    const resident = { id: 'res-1', name: 'João', cpf: '12345678901' } as Resident;
    const html = await service.renderForResident('tpl-1', resident);

    expect(html).toContain('Eu, João, CPF 123.456.789-01.');
  });

  it('falls back to "não informado" for missing fields', async () => {
    const repo = makeRepo({
      findOne: jest.fn().mockResolvedValue({ id: 'tpl-1', name: 'Termo', content: 'RG: {{rg}}' }),
    });
    const service = makeService(repo, makeRepo({ findOne: jest.fn().mockResolvedValue(null) }));

    const html = await service.renderForResident('tpl-1', { id: 'res-1', name: 'João' } as Resident);
    expect(html).toContain('RG: não informado');
  });
});
