import { render, screen, fireEvent } from '@testing-library/react-native';
import type { RelativeMe } from '@fonte/api-client';
import { ProfileAvatarHeader } from './ProfileAvatarHeader';

const me = { id: 'rel-1', name: 'Ana', relationship: 'Mãe' } as RelativeMe;

describe('ProfileAvatarHeader', () => {
  it('mostra nome e parentesco do familiar', () => {
    render(<ProfileAvatarHeader me={me} photoUrl={null} uploading={false} onPickPhoto={jest.fn()} />);
    expect(screen.getByText('Ana')).toBeOnTheScreen();
    expect(screen.getByText('Mãe')).toBeOnTheScreen();
  });

  it('mostra o ícone de pessoa quando não há foto', () => {
    render(<ProfileAvatarHeader me={me} photoUrl={null} uploading={false} onPickPhoto={jest.fn()} />);
    expect(screen.getByLabelText('Ionicons:person')).toBeOnTheScreen();
  });

  it('mostra spinner enquanto faz upload', () => {
    render(<ProfileAvatarHeader me={me} photoUrl={null} uploading onPickPhoto={jest.fn()} />);
    expect(screen.queryByLabelText('Ionicons:camera')).toBeNull();
  });

  it('dispara onPickPhoto ao tocar no avatar', () => {
    const { Pressable } = require('react-native');
    const onPickPhoto = jest.fn();
    render(<ProfileAvatarHeader me={me} photoUrl="u://a.jpg" uploading={false} onPickPhoto={onPickPhoto} />);
    fireEvent.press(screen.UNSAFE_root.findByType(Pressable));
    expect(onPickPhoto).toHaveBeenCalled();
  });
});
