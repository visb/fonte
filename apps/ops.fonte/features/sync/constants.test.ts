/**
 * Catálogo da tela de pendências (story 170, decisão 4).
 *
 * O teste-guarda é o primeiro: chave nova na outbox sem rótulo/apresentação
 * quebra aqui, em vez de chegar na mão do operador como "Lançamento pendente"
 * sem contexto nenhum.
 */
import { MovementType, ResidentStatus } from '@fonte/types';
import { OUTBOX_MUTATION_KEY_LIST, serializeMutationKey } from '@/lib/offline/outbox';
import {
  FALLBACK_SYNC_PRESENTATION,
  SYNC_ITEM_PRESENTATION,
  syncItemDetail,
  syncItemLabel,
  syncItemPresentation,
} from './constants';

describe('catálogo de chaves', () => {
  const keys = OUTBOX_MUTATION_KEY_LIST.map(serializeMutationKey);

  it.each(keys)('%s tem rótulo humano', (key) => {
    const label = syncItemLabel(key);
    expect(label).toBeTruthy();
    // 'Lançamento pendente' é o fallback do outbox: rótulo de verdade nunca é ele.
    expect(label).not.toBe('Lançamento pendente');
  });

  it.each(keys)('%s tem apresentação própria', (key) => {
    expect(SYNC_ITEM_PRESENTATION[key]).toBeDefined();
  });

  it('não sobra apresentação para chave que saiu do catálogo da outbox', () => {
    expect(Object.keys(SYNC_ITEM_PRESENTATION).sort()).toEqual([...keys].sort());
  });

  it('chave desconhecida cai num fallback legível em vez de sumir', () => {
    expect(syncItemPresentation('futuro/fluxo')).toBe(FALLBACK_SYNC_PRESENTATION);
    expect(syncItemLabel('futuro/fluxo')).toBe('Lançamento pendente');
    expect(syncItemDetail('futuro/fluxo', { data: {} })).toBeNull();
  });
});

describe('detalhe por chave', () => {
  it('movimentação mostra direção e quantidade (dispensa e almoxarifado)', () => {
    expect(
      syncItemDetail('storeroom/createMovement', {
        data: { itemId: 'i1', type: MovementType.IN, quantity: 2 },
      }),
    ).toBe('Entrada de 2');
    expect(
      syncItemDetail('supplyRoom/createMovement', {
        data: { itemId: 'i1', type: MovementType.OUT, quantity: 1.5 },
      }),
    ).toBe('Saída de 1,5');
  });

  it('filho da contagem mostra o nome; conclusão mostra a contagem', () => {
    expect(syncItemDetail('census/addResident', { data: { name: '  João da Silva ' } })).toBe(
      'João da Silva',
    );
    expect(
      syncItemDetail('census/conclude', { data: { confirmedCount: 18, total: 20 } }),
    ).toBe('18 de 20 filhos');
  });

  it('reacolhimento mostra o nome do filho (story 218)', () => {
    expect(
      syncItemDetail('census/readmitResident', { residentId: 'r9', residentName: ' Pedro ' }),
    ).toBe('Pedro');
    expect(syncItemLabel('census/readmitResident')).toBe('Filho reacolhido na contagem');
  });

  it('ocorrência e comentário truncam texto longo', () => {
    const long = 'a'.repeat(200);
    const detail = syncItemDetail('incidents/create', { data: { description: long } });
    expect(detail).toHaveLength(60);
    expect(detail?.endsWith('…')).toBe(true);
    expect(syncItemDetail('activities/comment', { data: { body: 'tudo certo' } })).toBe(
      'tudo certo',
    );
  });

  it('mudança de situação mostra o rótulo do status', () => {
    expect(
      syncItemDetail('residents/updateStatus', { data: { status: ResidentStatus.DISCIPLINE } }),
    ).toBe('Disciplina');
    expect(syncItemDetail('residents/updateStatus', { data: {} })).toBeNull();
  });

  it('itens e venda de rua mostram nome e quantidade', () => {
    expect(syncItemDetail('storeroom/createItem', { data: { name: 'Arroz' } })).toBe('Arroz');
    expect(syncItemDetail('supplyRoom/createItem', { data: { name: 'Sabão' } })).toBe('Sabão');
    expect(syncItemDetail('activities/create', { data: { title: 'Faxina' } })).toBe('Faxina');
    expect(syncItemDetail('streetSales/create', { data: { quantity: 30 } })).toBe('30 un.');
  });

  it('chaves sem detalhe próprio devolvem null', () => {
    expect(syncItemDetail('residents/uploadPhoto', { photoPath: 'file://x.jpg' })).toBeNull();
    expect(syncItemDetail('streetSales/update', { data: { quantity: 1 } })).toBeNull();
    expect(syncItemDetail('storeroom/createItem', { data: { name: '   ' } })).toBeNull();
  });

  it('variáveis em formato inesperado não derrubam a lista', () => {
    // Item vindo do disco de uma versão antiga do app: sem `data`.
    expect(syncItemDetail('storeroom/createMovement', null)).toBeNull();
    expect(syncItemDetail('census/conclude', {})).toBeNull();
  });
});
