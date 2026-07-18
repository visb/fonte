import { PreferenceController } from './preference.controller';
import { PreferenceService } from './preference.service';
import { AuthenticatedUser } from '../../common/decorators/current-user.decorator';

const user: AuthenticatedUser = {
  userId: 'user-A',
  role: 'ADMIN',
  profileType: 'STAFF',
};

function makeController() {
  const service = {
    getAll: jest.fn().mockResolvedValue({ 'residents.filters': { status: '' } }),
    set: jest.fn().mockResolvedValue(undefined),
    remove: jest.fn().mockResolvedValue(undefined),
  };
  const controller = new PreferenceController(
    service as unknown as PreferenceService,
  );
  return { controller, service };
}

describe('PreferenceController', () => {
  it('getAll usa sempre o userId do token', async () => {
    const { controller, service } = makeController();
    const result = await controller.getAll(user);
    expect(service.getAll).toHaveBeenCalledWith('user-A');
    expect(result).toEqual({ 'residents.filters': { status: '' } });
  });

  it('set encaminha userId do token, key do param e value do body', async () => {
    const { controller, service } = makeController();
    await controller.set(
      { key: 'residents.filters' },
      { value: { status: 'ACTIVE' } },
      user,
    );
    expect(service.set).toHaveBeenCalledWith('user-A', 'residents.filters', {
      status: 'ACTIVE',
    });
  });

  it('remove encaminha userId do token e key do param', async () => {
    const { controller, service } = makeController();
    await controller.remove({ key: 'residents.filters' }, user);
    expect(service.remove).toHaveBeenCalledWith('user-A', 'residents.filters');
  });
});
