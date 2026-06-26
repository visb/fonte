import { PublicAssociateController } from './public-associate.controller';
import { AssociatePaymentService } from './associate-payment.service';
import { SubscribeDto } from './dto/subscribe.dto';

function makeController(svc: Partial<AssociatePaymentService>) {
  return new PublicAssociateController(svc as AssociatePaymentService);
}

describe('PublicAssociateController', () => {
  it('returns the public view for a token', async () => {
    const getPublicView = jest.fn().mockResolvedValue({ name: 'Maria' });
    const controller = makeController({ getPublicView });
    await expect(controller.getPublic('tok')).resolves.toEqual({ name: 'Maria' });
    expect(getPublicView).toHaveBeenCalledWith('tok');
  });

  it('subscribes through the payment service', async () => {
    const subscribe = jest.fn().mockResolvedValue({ id: 'sub' });
    const controller = makeController({ subscribe });
    const dto = {} as SubscribeDto;
    await expect(controller.subscribe('tok', dto)).resolves.toEqual({ id: 'sub' });
    expect(subscribe).toHaveBeenCalledWith('tok', dto);
  });

  it('returns the cancel view', async () => {
    const getCancelView = jest.fn().mockResolvedValue({ cancelable: true });
    const controller = makeController({ getCancelView });
    await expect(controller.getCancelView('tok')).resolves.toEqual({ cancelable: true });
    expect(getCancelView).toHaveBeenCalledWith('tok');
  });

  it('cancels by token', async () => {
    const cancelByToken = jest.fn().mockResolvedValue({ canceled: true });
    const controller = makeController({ cancelByToken });
    await expect(controller.cancel('tok')).resolves.toEqual({ canceled: true });
    expect(cancelByToken).toHaveBeenCalledWith('tok');
  });
});
