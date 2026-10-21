import { fireEvent, render, screen } from '@testing-library/react-native';
import { ActivityStatus, Role } from '@fonte/types';
import type { Activity } from '@fonte/api-client';
import { ActivityCard } from './ActivityCard';

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

const coordinator = { role: Role.COORDINATOR, houseId: 'house-1' };
const servant = { role: Role.SERVANT, houseId: 'house-1' };

describe('ActivityCard — aprovar solicitação (story 220)', () => {
  it('coordenador da casa vê "Aprovar solicitação", que pede TODO', () => {
    const onChangeStatus = jest.fn();
    const item = makeActivity();
    render(
      <ActivityCard item={item} currentUserId="coord" viewer={coordinator} onChangeStatus={onChangeStatus} />,
    );
    fireEvent.press(screen.getByText('Aprovar solicitação'));
    expect(onChangeStatus).toHaveBeenCalledWith(item, ActivityStatus.TODO);
    expect(screen.queryByText('Devolver para rascunho')).toBeNull();
  });

  it('servo não vê "Aprovar solicitação"', () => {
    render(
      <ActivityCard item={makeActivity()} currentUserId="serv" viewer={servant} onChangeStatus={jest.fn()} />,
    );
    expect(screen.queryByText('Aprovar solicitação')).toBeNull();
  });

  it('coordenador de outra casa não vê "Aprovar solicitação"', () => {
    render(
      <ActivityCard
        item={makeActivity()}
        currentUserId="coord"
        viewer={{ role: Role.COORDINATOR, houseId: 'house-2' }}
        onChangeStatus={jest.fn()}
      />,
    );
    expect(screen.queryByText('Aprovar solicitação')).toBeNull();
  });

  it('criador-coordenador vê "Devolver para rascunho" e "Aprovar solicitação"', () => {
    render(
      <ActivityCard
        item={makeActivity()}
        currentUserId="creator-user"
        viewer={coordinator}
        onChangeStatus={jest.fn()}
      />,
    );
    expect(screen.getByText('Devolver para rascunho')).toBeTruthy();
    expect(screen.getByText('Aprovar solicitação')).toBeTruthy();
  });

  it('offline: aprovar fica desabilitado com o aviso', () => {
    const onChangeStatus = jest.fn();
    render(
      <ActivityCard
        item={makeActivity()}
        currentUserId="coord"
        viewer={coordinator}
        onChangeStatus={onChangeStatus}
        isOnline={false}
      />,
    );
    fireEvent.press(screen.getByText('Aprovar solicitação'));
    expect(onChangeStatus).not.toHaveBeenCalled();
    expect(screen.getByText('Precisa de conexão para mudar a situação.')).toBeTruthy();
  });
});

describe('ActivityCard — responsável tocável (story 220)', () => {
  const responsible = { id: 's1', name: 'Irmão João', userId: 'u-s1' };

  it('coordenador toca no responsável e abre o seletor (não o detalhe)', () => {
    const onPressResponsible = jest.fn();
    const onPress = jest.fn();
    const item = makeActivity({ status: ActivityStatus.TODO, responsible, responsibleStaffId: 's1' });
    render(
      <ActivityCard
        item={item}
        currentUserId="coord"
        viewer={coordinator}
        onChangeStatus={jest.fn()}
        onPress={onPress}
        onPressResponsible={onPressResponsible}
      />,
    );
    fireEvent.press(screen.getByLabelText('Trocar responsável: Irmão João'));
    expect(onPressResponsible).toHaveBeenCalledWith(item);
    expect(onPress).not.toHaveBeenCalled();
  });

  it('em Concluída o responsável não é tocável', () => {
    render(
      <ActivityCard
        item={makeActivity({ status: ActivityStatus.DONE, responsible })}
        currentUserId="coord"
        viewer={coordinator}
        onChangeStatus={jest.fn()}
        onPressResponsible={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('responsible-badge-button')).toBeNull();
    expect(screen.getByLabelText('Responsável: Irmão João')).toBeTruthy();
  });

  it('servo não recebe o responsável tocável', () => {
    render(
      <ActivityCard
        item={makeActivity({ status: ActivityStatus.TODO, responsible })}
        currentUserId="serv"
        viewer={servant}
        onChangeStatus={jest.fn()}
        onPressResponsible={jest.fn()}
      />,
    );
    expect(screen.queryByTestId('responsible-badge-button')).toBeNull();
  });

  it('offline: toque no responsável desabilitado com o aviso', () => {
    const onPressResponsible = jest.fn();
    render(
      <ActivityCard
        item={makeActivity({ status: ActivityStatus.TODO, responsible })}
        currentUserId="coord"
        viewer={coordinator}
        onChangeStatus={jest.fn()}
        onPressResponsible={onPressResponsible}
        isOnline={false}
      />,
    );
    fireEvent.press(screen.getByTestId('responsible-badge-button'));
    expect(onPressResponsible).not.toHaveBeenCalled();
    expect(screen.getByText('Precisa de conexão para trocar o responsável.')).toBeTruthy();
  });
});
