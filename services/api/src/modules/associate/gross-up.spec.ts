import { computeGrossUp } from './gross-up';

describe('computeGrossUp', () => {
  it('applies card fee (3.5% + R$0.60) to a R$50 contribution', () => {
    const { net, fee, gross } = computeGrossUp(50, 0.035, 0.6);
    // gross = (50 + 0.60) / (1 - 0.035) = 50.60 / 0.965 = 52.4352... → 52.44
    expect(gross).toBe(52.44);
    expect(net).toBe(50);
    expect(fee).toBe(2.44);
  });

  it('rounds gross to 2 decimals (half-up)', () => {
    const { gross } = computeGrossUp(100, 0.035, 0.6);
    // (100 + 0.60) / 0.965 = 104.2487... → 104.25
    expect(gross).toBe(104.25);
  });

  it('fee equals gross - net exactly', () => {
    const { net, fee, gross } = computeGrossUp(123.45, 0.04, 0.5);
    expect(fee).toBeCloseTo(gross - net, 2);
  });

  it('with zero fees, gross equals net', () => {
    const { net, fee, gross } = computeGrossUp(80, 0, 0);
    expect(gross).toBe(80);
    expect(fee).toBe(0);
    expect(net).toBe(80);
  });

  it('only fixed fee, no percentage', () => {
    const { gross, fee } = computeGrossUp(10, 0, 0.6);
    expect(gross).toBe(10.6);
    expect(fee).toBe(0.6);
  });

  it('only percentage fee, no fixed', () => {
    const { gross } = computeGrossUp(100, 0.1, 0);
    // 100 / 0.9 = 111.111... → 111.11
    expect(gross).toBe(111.11);
  });

  it('handles small amounts without float drift', () => {
    const { gross, fee, net } = computeGrossUp(0.01, 0.035, 0.6);
    expect(gross).toBe(0.63);
    expect(net).toBe(0.01);
    expect(fee).toBe(0.62);
  });

  it('throws when net is not positive', () => {
    expect(() => computeGrossUp(0, 0.035, 0.6)).toThrow();
    expect(() => computeGrossUp(-5, 0.035, 0.6)).toThrow();
  });

  it('throws when percentage is out of [0,1)', () => {
    expect(() => computeGrossUp(50, 1, 0.6)).toThrow();
    expect(() => computeGrossUp(50, -0.1, 0.6)).toThrow();
  });

  it('throws when fixed fee is negative', () => {
    expect(() => computeGrossUp(50, 0.035, -1)).toThrow();
  });
});
