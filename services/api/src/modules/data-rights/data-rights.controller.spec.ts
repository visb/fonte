import { DataRightsController } from './data-rights.controller';

describe('DataRightsController', () => {
  it('exportData delegates to the service', async () => {
    const s = { exportResident: jest.fn().mockResolvedValue({ id: 'r1' }), anonymizeResident: jest.fn() };
    await new DataRightsController(s as never).exportData('r1');
    expect(s.exportResident).toHaveBeenCalledWith('r1');
  });

  it('anonymize delegates to the service', async () => {
    const s = {
      exportResident: jest.fn(),
      anonymizeResident: jest.fn().mockResolvedValue({ anonymized: true, residentId: 'r1' }),
    };
    const out = await new DataRightsController(s as never).anonymize('r1');
    expect(s.anonymizeResident).toHaveBeenCalledWith('r1');
    expect(out).toEqual({ anonymized: true, residentId: 'r1' });
  });
});
