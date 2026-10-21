import { ActivityEventType } from '@fonte/types';
import { describeActivityEvent } from './eventDescription';

const resolve = (id: string) => ({ s1: 'Ana' } as Record<string, string>)[id];

describe('describeActivityEvent (story 220)', () => {
  it('tipo desconhecido cai num texto genérico', () => {
    expect(
      describeActivityEvent({ type: 'WEIRD' as ActivityEventType, metadata: null }, resolve),
    ).toBe('alterou a atividade');
  });

  it('status com valor fora das colunas mostra o código', () => {
    expect(
      describeActivityEvent(
        { type: ActivityEventType.STATUS_CHANGED, metadata: { from: 'X', to: 'Y' } },
        resolve,
      ),
    ).toBe('moveu de X para Y');
  });

  it('atribuição resolve o nome pelo id', () => {
    expect(
      describeActivityEvent(
        { type: ActivityEventType.RESPONSIBLE_CHANGED, metadata: { from: null, to: 's1' } },
        resolve,
      ),
    ).toBe('atribuiu a Ana');
  });
});
