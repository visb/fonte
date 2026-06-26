import { AssociateChargeController } from './associate-charge.controller';
import { AssociateChargeScheduler } from './associate-charge.scheduler';

describe('AssociateChargeController', () => {
  it('triggers a manual charge through the scheduler', async () => {
    const chargeManually = jest.fn().mockResolvedValue({ sent: true, skipped: false });
    const controller = new AssociateChargeController({
      chargeManually,
    } as unknown as AssociateChargeScheduler);
    await expect(controller.charge('a1')).resolves.toEqual({ sent: true, skipped: false });
    expect(chargeManually).toHaveBeenCalledWith('a1');
  });
});
