import { describe, expect, it, vi, beforeAll } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { AudioPlayer } from './AudioPlayer';

beforeAll(() => {
  // jsdom não implementa play/pause de HTMLMediaElement.
  Object.defineProperty(HTMLMediaElement.prototype, 'play', {
    configurable: true,
    value: vi.fn().mockResolvedValue(undefined),
  });
  Object.defineProperty(HTMLMediaElement.prototype, 'pause', {
    configurable: true,
    value: vi.fn(),
  });
});

describe('AudioPlayer', () => {
  it('mostra a duração conhecida vinda do backend', () => {
    render(<AudioPlayer src="blob:x" durationSeconds={65} />);
    expect(screen.getByText(/1:05/)).toBeInTheDocument();
  });

  it('play/pause: chama play e alterna o aria-label ao receber o evento', () => {
    const { container } = render(<AudioPlayer src="blob:x" durationSeconds={30} />);
    const audio = container.querySelector('audio') as HTMLAudioElement;

    const playBtn = screen.getByRole('button', { name: /Reproduzir áudio/i });
    fireEvent.click(playBtn);
    expect(HTMLMediaElement.prototype.play).toHaveBeenCalled();

    // o componente reflete o estado pelos eventos play/pause do <audio>
    fireEvent.play(audio);
    expect(screen.getByRole('button', { name: /Pausar áudio/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Pausar áudio/i }));
    expect(HTMLMediaElement.prototype.pause).toHaveBeenCalled();
  });

  it('troca de velocidade cicla 1x → 1.5x → 2x → 1x e ajusta playbackRate', () => {
    const { container } = render(<AudioPlayer src="blob:x" durationSeconds={30} />);
    const audio = container.querySelector('audio') as HTMLAudioElement;

    expect(screen.getByRole('button', { name: /Velocidade 1x/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Velocidade 1x/i }));
    expect(audio.playbackRate).toBe(1.5);
    expect(screen.getByRole('button', { name: /Velocidade 1.5x/i })).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Velocidade 1.5x/i }));
    expect(audio.playbackRate).toBe(2);

    fireEvent.click(screen.getByRole('button', { name: /Velocidade 2x/i }));
    expect(audio.playbackRate).toBe(1);
  });
});
