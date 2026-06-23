import { render, screen, fireEvent, waitFor, act } from '@testing-library/react-native';

// expo-av mockado: Audio.Sound controlado pelo teste (sem áudio nativo).
const mockSound = {
  pauseAsync: jest.fn().mockResolvedValue(undefined),
  playAsync: jest.fn().mockResolvedValue(undefined),
  setPositionAsync: jest.fn().mockResolvedValue(undefined),
  unloadAsync: jest.fn().mockResolvedValue(undefined),
};
let lastOnStatus: ((s: unknown) => void) | undefined;

jest.mock('expo-av', () => ({
  Audio: {
    setAudioModeAsync: jest.fn().mockResolvedValue(undefined),
    Sound: {
      createAsync: jest.fn((_src, _opts, onStatus) => {
        lastOnStatus = onStatus;
        return Promise.resolve({ sound: mockSound });
      }),
    },
  },
}));

import { Audio } from 'expo-av';
import { AudioPlayer } from './AudioPlayer';

beforeEach(() => {
  jest.clearAllMocks();
  lastOnStatus = undefined;
});

describe('AudioPlayer', () => {
  it('mostra "–:––" enquanto não há duração carregada', () => {
    render(<AudioPlayer url="u://a.m4a" isMine={false} />);
    expect(screen.getByText('–:––')).toBeOnTheScreen();
  });

  it('cria e toca o som no primeiro toque do play', async () => {
    render(<AudioPlayer url="u://a.m4a" isMine={false} />);
    fireEvent.press(screen.getByLabelText('Ionicons:play-circle'));

    await waitFor(() => expect(Audio.Sound.createAsync).toHaveBeenCalledTimes(1));
    expect(Audio.setAudioModeAsync).toHaveBeenCalled();
  });

  it('atualiza posição/duração via callback de status e formata mm:ss', async () => {
    render(<AudioPlayer url="u://a.m4a" isMine />);
    fireEvent.press(screen.getByLabelText('Ionicons:play-circle'));
    await waitFor(() => expect(lastOnStatus).toBeDefined());

    act(() => {
      lastOnStatus!({
        isLoaded: true,
        positionMillis: 5000,
        durationMillis: 65000,
        isPlaying: true,
      });
    });

    // posição 5s formatada
    expect(screen.getByText('00:05')).toBeOnTheScreen();
    // ao tocar, o ícone vira pause
    expect(screen.getByLabelText('Ionicons:pause-circle')).toBeOnTheScreen();
  });

  it('volta ao início quando o áudio termina (didJustFinish)', async () => {
    render(<AudioPlayer url="u://a.m4a" isMine={false} />);
    fireEvent.press(screen.getByLabelText('Ionicons:play-circle'));
    await waitFor(() => expect(lastOnStatus).toBeDefined());

    act(() => {
      lastOnStatus!({
        isLoaded: true,
        positionMillis: 65000,
        durationMillis: 65000,
        isPlaying: false,
        didJustFinish: true,
      });
    });

    expect(mockSound.setPositionAsync).toHaveBeenCalledWith(0);
  });

  it('pausa no segundo toque quando já está tocando', async () => {
    render(<AudioPlayer url="u://a.m4a" isMine={false} />);
    const play = screen.getByLabelText('Ionicons:play-circle');
    fireEvent.press(play);
    await waitFor(() => expect(Audio.Sound.createAsync).toHaveBeenCalled());

    act(() => {
      lastOnStatus!({ isLoaded: true, positionMillis: 0, durationMillis: 1000, isPlaying: true });
    });

    fireEvent.press(screen.getByLabelText('Ionicons:pause-circle'));
    await waitFor(() => expect(mockSound.pauseAsync).toHaveBeenCalledTimes(1));
  });
});
