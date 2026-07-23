import { describe, expect, it } from 'vitest';
import { RESIDENT_APP_ENABLED } from './features';

describe('feature flags', () => {
  // Guarda de regressão (story 149): o app do interno (`resident.fonte`) não
  // está em produção; a flag deve permanecer desligada até o lançamento, senão
  // a seção "Acesso Digital" do filho volta a aparecer para os operadores.
  it('RESIDENT_APP_ENABLED começa desligado', () => {
    expect(RESIDENT_APP_ENABLED).toBe(false);
  });
});
