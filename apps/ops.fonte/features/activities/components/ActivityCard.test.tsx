import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityStatus } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
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

describe('ActivityCard — devolver para rascunho (story 75)', () => {
  it('mostra a ação ao criador de uma solicitação (REQUESTED) e dispara DRAFT', () => {
    const onChangeStatus = jest.fn();
    const item = makeActivity();
    render(
      <ActivityCard
        item={item}
        currentUserId="creator-user"
        onChangeStatus={onChangeStatus}
      />,
    );

    const button = screen.getByText('Devolver para rascunho');
    fireEvent.press(button);

    expect(onChangeStatus).toHaveBeenCalledWith(item, ActivityStatus.DRAFT);
  });

  it('não mostra a ação para quem não é o criador', () => {
    render(
      <ActivityCard
        item={makeActivity()}
        currentUserId="other-user"
        onChangeStatus={jest.fn()}
      />,
    );

    expect(screen.queryByText('Devolver para rascunho')).toBeNull();
  });

  it('não mostra a ação fora de REQUESTED (ex.: DRAFT)', () => {
    render(
      <ActivityCard
        item={makeActivity({ status: ActivityStatus.DRAFT })}
        currentUserId="creator-user"
        onChangeStatus={jest.fn()}
      />,
    );

    expect(screen.queryByText('Devolver para rascunho')).toBeNull();
  });
});

describe('ActivityCard — transições por papel/status', () => {
  const responsible = { userId: 'resp-user', name: 'Servo R' } as Activity['responsible'];

  it('criador em DRAFT envia (REQUESTED)', () => {
    const onChangeStatus = jest.fn();
    const item = makeActivity({ status: ActivityStatus.DRAFT });
    render(<ActivityCard item={item} currentUserId="creator-user" onChangeStatus={onChangeStatus} />);
    fireEvent.press(screen.getByText('Enviar'));
    expect(onChangeStatus).toHaveBeenCalledWith(item, ActivityStatus.REQUESTED);
  });

  it('responsável em TODO inicia (DOING)', () => {
    const onChangeStatus = jest.fn();
    const item = makeActivity({ status: ActivityStatus.TODO, responsible });
    render(<ActivityCard item={item} currentUserId="resp-user" onChangeStatus={onChangeStatus} />);
    fireEvent.press(screen.getByText('Iniciar'));
    expect(onChangeStatus).toHaveBeenCalledWith(item, ActivityStatus.DOING);
  });

  it('responsável em DOING pode impedir e concluir', () => {
    const onChangeStatus = jest.fn();
    const item = makeActivity({ status: ActivityStatus.DOING, responsible });
    render(<ActivityCard item={item} currentUserId="resp-user" onChangeStatus={onChangeStatus} />);
    fireEvent.press(screen.getByText('Impedir'));
    expect(onChangeStatus).toHaveBeenCalledWith(item, ActivityStatus.BLOCKED);
    fireEvent.press(screen.getByText('Concluir'));
    expect(onChangeStatus).toHaveBeenCalledWith(item, ActivityStatus.DONE);
  });

  it('responsável em BLOCKED pode retomar e concluir', () => {
    const onChangeStatus = jest.fn();
    const item = makeActivity({ status: ActivityStatus.BLOCKED, responsible });
    render(<ActivityCard item={item} currentUserId="resp-user" onChangeStatus={onChangeStatus} />);
    fireEvent.press(screen.getByText('Retomar'));
    expect(onChangeStatus).toHaveBeenCalledWith(item, ActivityStatus.DOING);
    fireEvent.press(screen.getByText('Concluir'));
    expect(onChangeStatus).toHaveBeenCalledWith(item, ActivityStatus.DONE);
  });

  it('toca no corpo do card e dispara onPress', () => {
    const onPress = jest.fn();
    const item = makeActivity({ status: ActivityStatus.TODO });
    render(<ActivityCard item={item} currentUserId="x" onChangeStatus={jest.fn()} onPress={onPress} />);
    fireEvent.press(screen.getByText('Trocar lâmpada'));
    expect(onPress).toHaveBeenCalledWith(item);
  });

  it('quem não é responsável não vê ações de execução', () => {
    const item = makeActivity({ status: ActivityStatus.DOING, responsible });
    render(<ActivityCard item={item} currentUserId="outro" onChangeStatus={jest.fn()} />);
    expect(screen.queryByText('Concluir')).toBeNull();
    expect(screen.queryByText('Impedir')).toBeNull();
  });
});
