import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { outboxEntityId } from '@/lib/offline/outbox';
import { ActivityCard } from './ActivityCard';

// @expo/vector-icons depende de fontes nativas (indisponível no jest-expo): stub.
jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

function makeActivity(overrides: Partial<Activity> = {}): Activity {
  return {
    id: 'act-1',
    title: 'Trocar lâmpada',
    description: null,
    status: ActivityStatus.REQUESTED,
    houseId: 'house-1',
    house: null,
    responsibleStaffId: null,
    responsible: null,
    createdByUserId: 'creator-user',
    createdBy: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    ...overrides,
  };
}

describe('atividade criada sem sinal (story 171)', () => {
  it('aparece na lista marcada como pendente', () => {
    render(
      <ActivityCard
        item={makeActivity({ id: outboxEntityId('chave-1'), status: ActivityStatus.DRAFT })}
        currentUserId="creator-user"
        onChangeStatus={jest.fn()}
      />,
    );

    expect(screen.getByTestId('pending-sync-badge')).toBeTruthy();
    expect(screen.getByText('Trocar lâmpada')).toBeTruthy();
  });

  it('não abre detalhe nem muda de situação enquanto não subiu', () => {
    const onPress = jest.fn();
    const onChangeStatus = jest.fn();
    render(
      <ActivityCard
        item={makeActivity({ id: outboxEntityId('chave-1'), status: ActivityStatus.DRAFT })}
        currentUserId="creator-user"
        onChangeStatus={onChangeStatus}
        onPress={onPress}
      />,
    );

    // Sem id do servidor não há detalhe para abrir nem status para trocar.
    expect(screen.queryByText('Enviar solicitação')).toBeNull();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('atividade normal continua com selo nenhum', () => {
    render(
      <ActivityCard item={makeActivity()} currentUserId="creator-user" onChangeStatus={jest.fn()} />,
    );

    expect(screen.queryByTestId('pending-sync-badge')).toBeNull();
  });
});

describe('mudança de situação exige rede (decisão 4)', () => {
  it('sem sinal a ação fica desabilitada com o motivo escrito', () => {
    const onChangeStatus = jest.fn();
    render(
      <ActivityCard
        item={makeActivity()}
        currentUserId="creator-user"
        onChangeStatus={onChangeStatus}
        isOnline={false}
      />,
    );

    fireEvent.press(screen.getByText('Devolver para rascunho'));

    expect(onChangeStatus).not.toHaveBeenCalled();
    expect(screen.getByText('Precisa de conexão para mudar a situação.')).toBeTruthy();
  });

  it('com sinal a ação funciona normalmente', () => {
    const onChangeStatus = jest.fn();
    const item = makeActivity();
    render(
      <ActivityCard item={item} currentUserId="creator-user" onChangeStatus={onChangeStatus} />,
    );

    fireEvent.press(screen.getByText('Devolver para rascunho'));

    expect(onChangeStatus).toHaveBeenCalledWith(item, ActivityStatus.DRAFT);
    expect(screen.queryByText('Precisa de conexão para mudar a situação.')).toBeNull();
  });

  it('card sem ação nenhuma não mostra aviso de conexão', () => {
    render(
      <ActivityCard
        item={makeActivity({ status: ActivityStatus.DONE })}
        currentUserId="outro-user"
        onChangeStatus={jest.fn()}
        isOnline={false}
      />,
    );

    expect(screen.queryByText('Precisa de conexão para mudar a situação.')).toBeNull();
  });

  it('responsável em situação sem transição também fica sem ações', () => {
    render(
      <ActivityCard
        item={makeActivity({
          status: ActivityStatus.DONE,
          responsible: { id: 's1', name: 'Irmão João', userId: 'user-1' } as never,
        })}
        currentUserId="user-1"
        onChangeStatus={jest.fn()}
        isOnline={false}
      />,
    );

    expect(screen.queryByText('Concluir')).toBeNull();
    expect(screen.queryByText('Precisa de conexão para mudar a situação.')).toBeNull();
  });
});
