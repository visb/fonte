import { AppSettingsController } from './app-settings.controller';
import { AppSettingsService } from './app-settings.service';
import { UpdateAppSettingsDto } from './dto/update-app-settings.dto';

function makeController(svc: Partial<AppSettingsService>) {
  return new AppSettingsController(svc as AppSettingsService);
}

describe('AppSettingsController', () => {
  it('returns settings from the service', async () => {
    const get = jest.fn().mockResolvedValue({ key: 'value' });
    const controller = makeController({ get });
    await expect(controller.get()).resolves.toEqual({ key: 'value' });
    expect(get).toHaveBeenCalled();
  });

  it('updates settings via the service', async () => {
    const update = jest.fn().mockResolvedValue({ updated: true });
    const controller = makeController({ update });
    const dto = {} as UpdateAppSettingsDto;
    await expect(controller.update(dto)).resolves.toEqual({ updated: true });
    expect(update).toHaveBeenCalledWith(dto);
  });
});
