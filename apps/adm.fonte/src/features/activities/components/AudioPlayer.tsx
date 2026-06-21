import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { formatDuration } from '../lib/attachments';

const SPEEDS = [1, 1.5, 2] as const;

interface Props {
  src: string;
  /** Duração conhecida (segundos) vinda do backend; fallback para metadados do <audio>. */
  durationSeconds?: number | null;
}

/**
 * Player de áudio (story 74) para anexos `file_type = audio`: play/pause, barra
 * de progresso/tempo e seletor de velocidade 1x/1.5x/2x (via `playbackRate`).
 * Controla um `<audio>` oculto; o navegador faz o streaming da `src`.
 */
export function AudioPlayer({ src, durationSeconds }: Props) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [playing, setPlaying] = useState(false);
  const [current, setCurrent] = useState(0);
  const [duration, setDuration] = useState(durationSeconds ?? 0);
  const [speed, setSpeed] = useState<(typeof SPEEDS)[number]>(1);

  const toggle = () => {
    const el = audioRef.current;
    if (!el) return;
    // Guia-se pelo estado de UI (refletido pelos eventos play/pause do <audio>),
    // não por `el.paused`, para se comportar de forma previsível e testável.
    if (playing) {
      el.pause();
    } else {
      void el.play();
    }
  };

  const cycleSpeed = () => {
    const next = SPEEDS[(SPEEDS.indexOf(speed) + 1) % SPEEDS.length];
    setSpeed(next);
    if (audioRef.current) audioRef.current.playbackRate = next;
  };

  const onSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = Number(e.target.value);
    setCurrent(value);
    if (audioRef.current) audioRef.current.currentTime = value;
  };

  return (
    <div className="flex items-center gap-2 rounded-md bg-muted/40 px-2 py-1.5">
      <audio
        ref={audioRef}
        src={src}
        preload="metadata"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onTimeUpdate={(e) => setCurrent(e.currentTarget.currentTime)}
        onLoadedMetadata={(e) => {
          const d = e.currentTarget.duration;
          if (Number.isFinite(d) && d > 0) setDuration(d);
        }}
        onEnded={() => setPlaying(false)}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 w-7 shrink-0 p-0"
        onClick={toggle}
        aria-label={playing ? 'Pausar áudio' : 'Reproduzir áudio'}
      >
        {playing ? '⏸️' : '▶️'}
      </Button>
      <input
        type="range"
        min={0}
        max={duration || 0}
        step={0.1}
        value={Math.min(current, duration || 0)}
        onChange={onSeek}
        className="h-1 flex-1 cursor-pointer"
        aria-label="Progresso do áudio"
      />
      <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
        {formatDuration(current)} / {formatDuration(duration)}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-7 shrink-0 px-2 text-xs"
        onClick={cycleSpeed}
        aria-label={`Velocidade ${speed}x`}
      >
        {speed}x
      </Button>
    </div>
  );
}
