import { StorageController } from './storage.controller';
import { StorageReconcileService } from './storage-reconcile.service';

function makeController(reconcile: jest.Mock) {
  const service = { reconcile } as unknown as StorageReconcileService;
  return new StorageController(service);
}

describe('StorageController.reconcile (story 93)', () => {
  it('roda em dry-run por padrão (apply ausente → false)', async () => {
    const reconcile = jest.fn().mockResolvedValue({ apply: false });
    const controller = makeController(reconcile);

    await controller.reconcile({});

    expect(reconcile).toHaveBeenCalledWith(false);
  });

  it('repassa apply=true quando solicitado explicitamente', async () => {
    const reconcile = jest.fn().mockResolvedValue({ apply: true });
    const controller = makeController(reconcile);

    await controller.reconcile({ apply: true });

    expect(reconcile).toHaveBeenCalledWith(true);
  });
});
