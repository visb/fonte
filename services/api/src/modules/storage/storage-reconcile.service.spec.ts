import { DataSource } from 'typeorm';
import { StorageReconcileService } from './storage-reconcile.service';
import { StorageService } from './storage.service';
import { extractImageUrls } from './storage.util';

const BASE = 'https://bucket';

function keyFromUrl(url: string | null | undefined): string | null {
  if (typeof url !== 'string') return null;
  const base = url.split('?')[0];
  return base.startsWith(`${BASE}/`) ? base.slice(`${BASE}/`.length) : null;
}

// DataSource.query stub: devolve linhas só para as fontes exercitadas no teste.
function makeDataSource(): { query: jest.Mock } {
  return {
    query: jest.fn(async (sql: string) => {
      if (sql.includes('"residents"') && sql.includes('photo_url')) {
        return [{ url: `${BASE}/residents/p.png` }];
      }
      if (sql.includes('document_templates')) {
        return [{ content: `<img src="${BASE}/documents/d.png">` }];
      }
      if (sql.includes('event_registrations')) {
        return [
          { answers: { f1: `${BASE}/event-registrations/r.pdf`, t: 'texto' } },
          { answers: null },
        ];
      }
      return [];
    }),
  };
}

function makeStorage(overrides: Partial<StorageService> = {}): StorageService {
  return {
    keyFromUrl: jest.fn(keyFromUrl),
    extractBucketImageUrls: jest.fn((h: string) => extractImageUrls(h, BASE)),
    listBucketKeys: jest.fn().mockResolvedValue([
      'residents/p.png',
      'documents/d.png',
      'event-registrations/r.pdf',
      'orphan/x.png',
    ]),
    delete: jest.fn().mockResolvedValue(undefined),
    ...overrides,
  } as unknown as StorageService;
}

function makeService(storage: StorageService, dataSource: { query: jest.Mock }) {
  return new StorageReconcileService(
    dataSource as unknown as DataSource,
    storage,
  );
}

describe('StorageReconcileService.collectReferencedKeys (story 93)', () => {
  it('reúne keys das colunas de URL, do wysiwyg e das respostas de inscrição', async () => {
    const storage = makeStorage();
    const service = makeService(storage, makeDataSource());

    const keys = await service.collectReferencedKeys();

    expect([...keys].sort()).toEqual(
      ['documents/d.png', 'event-registrations/r.pdf', 'residents/p.png'].sort(),
    );
  });
});

describe('StorageReconcileService.reconcile (story 93)', () => {
  it('dry-run (apply=false) lista os órfãos e NÃO apaga nada', async () => {
    const storage = makeStorage();
    const service = makeService(storage, makeDataSource());

    const report = await service.reconcile(false);

    expect(report).toMatchObject({
      apply: false,
      bucketObjects: 4,
      referencedObjects: 3,
      orphanCount: 1,
      orphanKeys: ['orphan/x.png'],
      deletedCount: 0,
    });
    expect(storage.delete).not.toHaveBeenCalled();
  });

  it('apply=true apaga cada órfão e conta as deleções', async () => {
    const storage = makeStorage();
    const service = makeService(storage, makeDataSource());

    const report = await service.reconcile(true);

    expect(storage.delete).toHaveBeenCalledTimes(1);
    expect(storage.delete).toHaveBeenCalledWith('orphan/x.png');
    expect(report).toMatchObject({
      apply: true,
      orphanCount: 1,
      deletedCount: 1,
    });
  });

  it('apply=true é best-effort: falha numa deleção não aborta a varredura', async () => {
    const storage = makeStorage({
      listBucketKeys: jest
        .fn()
        .mockResolvedValue(['orphan/x.png', 'orphan/y.png']) as never,
      delete: jest
        .fn()
        .mockRejectedValueOnce(new Error('s3 down'))
        .mockResolvedValueOnce(undefined) as never,
    });
    const service = makeService(storage, makeDataSource());

    const report = await service.reconcile(true);

    // Duas tentativas; só a segunda conta como deletada.
    expect(storage.delete).toHaveBeenCalledTimes(2);
    expect(report.orphanCount).toBe(2);
    expect(report.deletedCount).toBe(1);
  });
});
