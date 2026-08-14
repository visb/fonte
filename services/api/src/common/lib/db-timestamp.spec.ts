import { toDbTimestamp } from './db-timestamp';

describe('toDbTimestamp', () => {
  it('devolve o literal UTC que a coluna timestamp sem fuso guarda', () => {
    expect(toDbTimestamp(new Date('2026-08-14T18:41:29.123Z'))).toBe('2026-08-14 18:41:29.123');
  });

  it('não depende do fuso do processo — o instante é o mesmo em qualquer offset', () => {
    // Mesmo instante, escrito com offset: a conversão precisa normalizar em UTC,
    // senão o delta abre uma janela do tamanho do offset do servidor.
    expect(toDbTimestamp(new Date('2026-08-14T15:41:29.123-03:00'))).toBe(
      '2026-08-14 18:41:29.123',
    );
  });
});
