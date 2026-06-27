import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { View } from 'react-native';

function findTrack(root: { UNSAFE_getAllByType: (t: unknown) => { props: Record<string, unknown> }[] }) {
  return root.UNSAFE_getAllByType(View).find((n) => typeof n.props.onTouchEnd === 'function')!;
}

jest.mock('@expo/vector-icons', () => {
  const { Text } = require('react-native');
  return { Ionicons: ({ name }: { name: string }) => <Text>{`icon:${name}`}</Text> };
});

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Sound: { createAsync: jest.fn() },
  },
}));

import { Audio } from 'expo-av';
import { AudioPlayer } from './AudioPlayer';

const createAsync = Audio.Sound.createAsync as jest.Mock;
const setAudioModeAsync = Audio.setAudioModeAsync as jest.Mock;

type StatusCb = (s: Record<string, unknown>) => void;

function makeSound() {
  return {
    pauseAsync: jest.fn().mockResolvedValue(undefined),
    playAsync: jest.fn().mockResolvedValue(undefined),
    setPositionAsync: jest.fn().mockResolvedValue(undefined),
    unloadAsync: jest.fn().mockResolvedValue(undefined),
  };
}

beforeEach(() => jest.clearAllMocks());

describe('messages/AudioPlayer — ciclo de reprodução', () => {
  it('toca, recebe status (posição/duração), pausa e retoma', async () => {
    let statusCb: StatusCb = () => {};
    const sound = makeSound();
    createAsync.mockImplementation((_uri, _opts, cb: StatusCb) => {
      statusCb = cb;
      return Promise.resolve({ sound });
    });

    render(<AudioPlayer url="https://x/a.m4a" isOwn />);
    // play
    fireEvent.press(screen.getByText('icon:play-circle'));
    await waitFor(() => expect(createAsync).toHaveBeenCalled());
    expect(setAudioModeAsync).toHaveBeenCalled();

    // status: tocando, com posição e duração → mostra ícone de pause e tempo formatado
    act(() => {
      statusCb({ isLoaded: true, isPlaying: true, positionMillis: 5000, durationMillis: 65000 });
    });
    await waitFor(() => expect(screen.getByText('icon:pause-circle')).toBeTruthy());
    expect(screen.getByText('00:05')).toBeTruthy();

    // pause (já existe sound + isPlaying)
    fireEvent.press(screen.getByText('icon:pause-circle'));
    await waitFor(() => expect(sound.pauseAsync).toHaveBeenCalled());

    // status: pausado → ícone volta para play
    act(() => {
      statusCb({ isLoaded: true, isPlaying: false, positionMillis: 5000, durationMillis: 65000 });
    });
    await waitFor(() => expect(screen.getByText('icon:play-circle')).toBeTruthy());

    // retomar (sound existe e não está tocando → playAsync)
    fireEvent.press(screen.getByText('icon:play-circle'));
    await waitFor(() => expect(sound.playAsync).toHaveBeenCalled());
  });

  it('status não-carregado é ignorado e didJustFinish reinicia a posição', async () => {
    let statusCb: StatusCb = () => {};
    const sound = makeSound();
    createAsync.mockImplementation((_uri, _opts, cb: StatusCb) => {
      statusCb = cb;
      return Promise.resolve({ sound });
    });
    render(<AudioPlayer url="https://x/a.m4a" isOwn={false} />);
    fireEvent.press(screen.getByText('icon:play-circle'));
    await waitFor(() => expect(createAsync).toHaveBeenCalled());

    act(() => statusCb({ isLoaded: false }));
    act(() => statusCb({ isLoaded: true, isPlaying: false, positionMillis: 0, durationMillis: 60000, didJustFinish: true }));
    await waitFor(() => expect(sound.setPositionAsync).toHaveBeenCalledWith(0));
  });

  it('seek após layout move a posição proporcionalmente', async () => {
    let statusCb: StatusCb = () => {};
    const sound = makeSound();
    createAsync.mockImplementation((_uri, _opts, cb: StatusCb) => {
      statusCb = cb;
      return Promise.resolve({ sound });
    });
    const root = render(<AudioPlayer url="https://x/a.m4a" isOwn={false} />);
    fireEvent.press(screen.getByText('icon:play-circle'));
    await waitFor(() => expect(createAsync).toHaveBeenCalled());
    act(() => statusCb({ isLoaded: true, isPlaying: true, positionMillis: 0, durationMillis: 100000 }));

    const track = findTrack(root);
    act(() => (track.props.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { width: 200 } } }));
    await act(async () => {
      await (track.props.onTouchEnd as (e: unknown) => Promise<void>)({ nativeEvent: { locationX: 100 } });
    });
    expect(sound.setPositionAsync).toHaveBeenCalledWith(50000);
  });

  it('seek sem sound carregado não faz nada', () => {
    const root = render(<AudioPlayer url="https://x/a.m4a" isOwn={false} />);
    const track = findTrack(root);
    act(() => (track.props.onLayout as (e: unknown) => void)({ nativeEvent: { layout: { width: 200 } } }));
    // sem togglePlay → soundRef nulo: handleSeek retorna cedo
    (track.props.onTouchEnd as (e: unknown) => void)({ nativeEvent: { locationX: 100 } });
    expect(createAsync).not.toHaveBeenCalled();
  });
});
