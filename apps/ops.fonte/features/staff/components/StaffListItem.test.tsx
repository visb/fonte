import { Linking } from 'react-native';
import { fireEvent, render, screen } from '@testing-library/react-native';
import { Role } from '@fonte/types';
import type { HouseStaffMember } from '@fonte/api-client';

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});
jest.mock('@/lib/api', () => ({
  resolveAssetUrl: (u: string | null) => (u ? `http://api${u}` : null),
}));

import { StaffListItem } from './StaffListItem';

function member(overrides: Partial<HouseStaffMember> = {}): HouseStaffMember {
  return {
    id: 's1',
    name: 'Ana Maria Souza',
    whatsapp: '(62) 99999-0000',
    photoUrl: null,
    role: Role.SERVANT,
    ledMinistries: [],
    ...overrides,
  };
}

let openURL: jest.SpyInstance;

beforeEach(() => {
  openURL = jest.spyOn(Linking, 'openURL').mockResolvedValue(true);
});

afterEach(() => openURL.mockRestore());

describe('StaffListItem', () => {
  it('mostra nome, papel e ministérios liderados', () => {
    render(
      <StaffListItem
        item={member({
          role: Role.COORDINATOR,
          ledMinistries: [
            { id: 'm1', name: 'Cozinha' },
            { id: 'm2', name: 'Horta' },
          ],
        })}
        isSelf={false}
      />,
    );
    expect(screen.getByText('Ana Maria Souza')).toBeTruthy();
    expect(screen.getByText('Coordenador')).toBeTruthy();
    expect(screen.getByText('Lidera: Cozinha, Horta')).toBeTruthy();
  });

  it('servo sem ministério não mostra a linha de liderança; iniciais no lugar da foto', () => {
    render(<StaffListItem item={member()} isSelf={false} />);
    expect(screen.getByText('Servo')).toBeTruthy();
    expect(screen.queryByText(/Lidera:/)).toBeNull();
    expect(screen.getByText('AS')).toBeTruthy();
    expect(screen.queryByTestId('staff-photo')).toBeNull();
  });

  it('com foto, renderiza a imagem resolvida', () => {
    render(<StaffListItem item={member({ photoUrl: '/uploads/staff/a.jpg' })} isSelf={false} />);
    expect(screen.getByTestId('staff-photo').props.source).toEqual({
      uri: 'http://api/uploads/staff/a.jpg',
    });
  });

  it('com WhatsApp, o botão abre wa.me com o número normalizado com 55', () => {
    render(<StaffListItem item={member()} isSelf={false} />);
    fireEvent.press(screen.getByLabelText('WhatsApp de Ana Maria Souza'));
    expect(openURL).toHaveBeenCalledWith('https://wa.me/5562999990000');
  });

  it('sem WhatsApp, não há botão', () => {
    render(<StaffListItem item={member({ whatsapp: null })} isSelf={false} />);
    expect(screen.queryByLabelText('WhatsApp de Ana Maria Souza')).toBeNull();
  });

  it('o usuário logado aparece com "(você)" e sem botão', () => {
    render(<StaffListItem item={member()} isSelf />);
    expect(screen.getByText(/\(você\)/)).toBeTruthy();
    expect(screen.queryByLabelText('WhatsApp de Ana Maria Souza')).toBeNull();
  });

  it('papel desconhecido cai no rótulo cru com badge neutro', () => {
    render(<StaffListItem item={member({ role: 'RELATIVE' as Role, name: 'Zé' })} isSelf={false} />);
    expect(screen.getByText('RELATIVE')).toBeTruthy();
    expect(screen.getByText('Z')).toBeTruthy();
  });
});
