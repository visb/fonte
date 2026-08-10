import { QUERY_GC_TIME } from './offline/constants';
import { queryClient } from './queryClient';

describe('queryClient', () => {
  const queries = queryClient.getDefaultOptions().queries;

  it('mantém gcTime alinhado ao maxAge do cache persistido', () => {
    // Com o default de 5 min a query some antes de o cache reidratado servir
    // para alguma coisa — a persistência viraria enfeite.
    expect(queries?.gcTime).toBe(QUERY_GC_TIME);
  });

  it('usa networkMode offlineFirst (sem sinal, pausa em vez de errar)', () => {
    expect(queries?.networkMode).toBe('offlineFirst');
  });

  it('preserva retry e staleTime originais', () => {
    expect(queries?.retry).toBe(1);
    expect(queries?.staleTime).toBe(30_000);
  });
});
