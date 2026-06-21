import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import {
  AUDIO_MAX_DURATION_SECONDS,
  formatDuration,
} from '../lib/attachments';

interface Props {
  onRecorded: (file: File, durationSeconds: number) => void;
  uploading: boolean;
}

/**
 * Gravador de áudio (story 74): usa `MediaRecorder` para gravar pelo microfone,
 * com timer e auto-stop em 2:00. Ao parar, monta um `File` (`audio/webm`) com a
 * duração medida e dispara `onRecorded`. Pede permissão de microfone; erros são
 * exibidos em pt-BR. Salva o formato nativo do device — sem transcodação.
 */
export function AudioRecorder({ onRecorded, uploading }: Props) {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startedAtRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState<unknown>(null);

  const stopTimer = () => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const stop = () => {
    recorderRef.current?.state === 'recording' && recorderRef.current.stop();
  };

  const start = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      chunksRef.current = [];
      startedAtRef.current = Date.now();

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopTimer();
        setRecording(false);
        stream.getTracks().forEach((t) => t.stop());
        const durationSeconds = (Date.now() - startedAtRef.current) / 1000;
        const type = recorder.mimeType || 'audio/webm';
        const ext = type.includes('mp4') ? 'm4a' : 'webm';
        const blob = new Blob(chunksRef.current, { type });
        const file = new File([blob], `gravacao-${Date.now()}.${ext}`, {
          type,
        });
        onRecorded(file, durationSeconds);
      };

      recorder.start();
      setRecording(true);
      setElapsed(0);
      timerRef.current = setInterval(() => {
        const secs = (Date.now() - startedAtRef.current) / 1000;
        setElapsed(secs);
        if (secs >= AUDIO_MAX_DURATION_SECONDS) stop();
      }, 250);
    } catch (e) {
      setError(e);
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        {recording ? (
          <>
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={stop}
              aria-label="Parar gravação"
            >
              ⏹️ Parar
            </Button>
            <span className="text-xs tabular-nums text-muted-foreground">
              {formatDuration(elapsed)} / {formatDuration(AUDIO_MAX_DURATION_SECONDS)}
            </span>
          </>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={start}
            disabled={uploading}
            aria-label="Gravar áudio"
          >
            🎙️ Gravar áudio
          </Button>
        )}
      </div>
      {error != null && (
        <p className="text-xs text-destructive">
          {getErrorMessage(error, 'Não foi possível acessar o microfone.')}
        </p>
      )}
    </div>
  );
}
