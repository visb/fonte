import { NotFoundException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { DataRightsService } from './data-rights.service';
import { StorageService } from '../storage/storage.service';

function makeService(queryImpl: (sql: string, params: unknown[]) => Promise<unknown[]>, del = jest.fn()) {
  const dataSource = { query: jest.fn(queryImpl) } as unknown as DataSource;
  const storage = { delete: del } as unknown as StorageService;
  return { service: new DataRightsService(dataSource, storage), del, query: dataSource.query as jest.Mock };
}

describe('DataRightsService.exportResident', () => {
  it('aggregates resident data across tables', async () => {
    const { service } = makeService(async (sql) => {
      if (sql.includes('FROM residents')) return [{ id: 'r1', name: 'Ana' }];
      return [];
    });

    const out = await service.exportResident('r1');

    expect(out.subject).toEqual({ type: 'RESIDENT', id: 'r1' });
    expect(out.resident).toMatchObject({ id: 'r1' });
    expect(out).toHaveProperty('admissions');
    expect(out).toHaveProperty('consents');
  });

  it('throws when resident does not exist', async () => {
    const { service } = makeService(async () => []);
    await expect(service.exportResident('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('DataRightsService.anonymizeResident', () => {
  it('deletes files and pseudonymizes identifying columns', async () => {
    const del = jest.fn().mockResolvedValue(undefined);
    const { service, query } = makeService(async (sql) => {
      if (sql.includes('SELECT id, photo_url')) return [{ id: 'r1', photo_url: 'p.jpg', photo_thumb_url: 't.jpg' }];
      if (sql.includes('FROM resident_attachments')) return [{ file_url: 'a.pdf' }];
      if (sql.includes('signed_file_url')) return [{ signed_file_url: 's.pdf' }];
      return [];
    }, del);

    const res = await service.anonymizeResident('r1');

    expect(res).toEqual({ anonymized: true, residentId: 'r1' });
    expect(del).toHaveBeenCalledWith('p.jpg');
    expect(del).toHaveBeenCalledWith('a.pdf');
    expect(del).toHaveBeenCalledWith('s.pdf');

    const updateSqls = query.mock.calls.map((c) => c[0] as string);
    expect(updateSqls.some((s) => s.includes('UPDATE residents SET') && s.includes("name = 'Titular anonimizado'"))).toBe(true);
    expect(updateSqls.some((s) => s.includes('UPDATE relatives SET'))).toBe(true);
    expect(updateSqls.some((s) => s.includes('DELETE FROM resident_attachments'))).toBe(true);
  });

  it('throws when resident does not exist', async () => {
    const { service } = makeService(async () => []);
    await expect(service.anonymizeResident('missing')).rejects.toBeInstanceOf(NotFoundException);
  });
});
