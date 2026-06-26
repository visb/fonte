import { PublicEventPaymentController } from './public-event-payment.controller';
import { EventPaymentService } from './event-payment.service';
import { PayEventDto } from './dto/pay-event.dto';

function makeController(svc: Partial<EventPaymentService>) {
  return new PublicEventPaymentController(svc as EventPaymentService);
}

describe('PublicEventPaymentController', () => {
  it('returns the public registration view', async () => {
    const getPublicView = jest.fn().mockResolvedValue({ event: 'Retiro' });
    const controller = makeController({ getPublicView });
    await expect(controller.getPublic('tok')).resolves.toEqual({ event: 'Retiro' });
    expect(getPublicView).toHaveBeenCalledWith('tok');
  });

  it('creates a payment charge', async () => {
    const pay = jest.fn().mockResolvedValue({ status: 'PENDING' });
    const controller = makeController({ pay });
    const dto = {} as PayEventDto;
    await expect(controller.pay('tok', dto)).resolves.toEqual({ status: 'PENDING' });
    expect(pay).toHaveBeenCalledWith('tok', dto);
  });
});
