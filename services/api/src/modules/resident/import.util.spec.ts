import { monthsBetween } from './import.util';

describe('monthsBetween', () => {
  it('conta 6 quando são exatamente 6 meses (mesmo dia)', () => {
    expect(monthsBetween('2023-01-15', '2023-07-15')).toBe(6);
  });

  it('conta 5 quando faltam dias para fechar o 6º mês (5m29d)', () => {
    expect(monthsBetween('2023-01-15', '2023-07-14')).toBe(5);
  });

  it('conta 0 quando a saída é anterior à entrada', () => {
    expect(monthsBetween('2023-07-15', '2023-01-15')).toBe(0);
  });

  it('conta 0 quando as datas são iguais', () => {
    expect(monthsBetween('2023-05-10', '2023-05-10')).toBe(0);
  });

  it('atravessa a virada de ano corretamente', () => {
    expect(monthsBetween('2022-11-10', '2023-02-10')).toBe(3);
    expect(monthsBetween('2022-11-10', '2023-05-09')).toBe(5);
  });

  it('ignora a parte de hora quando recebe datetime ISO', () => {
    expect(monthsBetween('2023-01-15T09:00:00Z', '2023-07-15T23:00:00Z')).toBe(6);
  });
});
