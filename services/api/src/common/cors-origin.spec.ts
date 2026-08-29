import { parseCorsOrigin } from './cors-origin';

describe('parseCorsOrigin', () => {
  it('returns a single-entry list for one origin', () => {
    expect(parseCorsOrigin('https://adm.fontedemisericordia.com.br')).toEqual([
      'https://adm.fontedemisericordia.com.br',
    ]);
  });

  it('splits a comma-separated list into every origin', () => {
    expect(
      parseCorsOrigin(
        'https://adm.fontedemisericordia.com.br,https://ops.fontedemisericordia.com.br',
      ),
    ).toEqual([
      'https://adm.fontedemisericordia.com.br',
      'https://ops.fontedemisericordia.com.br',
    ]);
  });

  it('trims whitespace around each origin', () => {
    expect(
      parseCorsOrigin('  https://adm.example.com ,\thttps://ops.example.com  \n'),
    ).toEqual(['https://adm.example.com', 'https://ops.example.com']);
  });

  it('drops empty entries left by trailing or doubled separators', () => {
    expect(parseCorsOrigin('https://adm.example.com,,  ,')).toEqual([
      'https://adm.example.com',
    ]);
  });

  it('de-duplicates repeated origins', () => {
    expect(
      parseCorsOrigin('https://adm.example.com, https://adm.example.com'),
    ).toEqual(['https://adm.example.com']);
  });

  // Absent variable => open CORS, the behaviour dev and the e2e suites rely on.
  it('returns null when the variable is undefined', () => {
    expect(parseCorsOrigin(undefined)).toBeNull();
  });

  it('returns null when the variable is null', () => {
    expect(parseCorsOrigin(null)).toBeNull();
  });

  it('returns null for an empty string', () => {
    expect(parseCorsOrigin('')).toBeNull();
  });

  it('returns null for a value made only of separators and whitespace', () => {
    expect(parseCorsOrigin('  , ,  ')).toBeNull();
  });
});
