import { RetentionController } from './retention.controller';

describe('RetentionController', () => {
  it('run delegates to purgeExpired', async () => {
    const s = { purgeExpired: jest.fn().mockResolvedValue({ anonymized: 3 }) };
    const out = await new RetentionController(s as never).run();
    expect(s.purgeExpired).toHaveBeenCalled();
    expect(out).toEqual({ anonymized: 3 });
  });
});
