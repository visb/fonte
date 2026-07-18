import { describe, expect, it } from 'vitest';
import { queryKeys } from './queryKeys';

describe('queryKeys', () => {
  it('mantém as chaves base estáveis', () => {
    expect(queryKeys.associates.all).toEqual(['associates']);
    expect(queryKeys.houses.all).toEqual(['houses']);
    expect(queryKeys.residents.all).toEqual(['residents']);
    expect(queryKeys.payables.all).toEqual(['payables']);
    expect(queryKeys.activities.all).toEqual(['activities']);
  });

  it('compõe chaves de detalhe a partir do id', () => {
    expect(queryKeys.associates.detail('a1')).toEqual(['associates', 'a1']);
    expect(queryKeys.houses.detail('h1')).toEqual(['houses', 'h1']);
    expect(queryKeys.residents.detail('r1')).toEqual(['residents', 'r1']);
  });

  it('inclui parâmetros em chaves de listagem/overview', () => {
    expect(queryKeys.associates.overview(6)).toEqual(['associates', 'overview', 6]);
    expect(queryKeys.payables.list({ status: 'OPEN' })).toEqual([
      'payables',
      'list',
      { status: 'OPEN' },
    ]);
  });

  it('a chave da listagem de residentes muda com a ordenação (story 129)', () => {
    expect(queryKeys.residents.list({ sort: 'entryDate', order: 'desc' })).not.toEqual(
      queryKeys.residents.list({ sort: 'name', order: 'asc' }),
    );
  });

  it('produz a mesma chave para a mesma entrada (referência estável por estrutura)', () => {
    expect(queryKeys.associates.detail('x')).toEqual(queryKeys.associates.detail('x'));
    expect(queryKeys.houses.ministries('h')).toEqual(['houses', 'h', 'ministries']);
  });
});
