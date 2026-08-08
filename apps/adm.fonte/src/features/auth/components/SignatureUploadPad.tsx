import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DEFAULT_BACKGROUND_THRESHOLD,
  canvasToPngBlob,
  decodeImageFile,
  drawSignature,
  validateSignatureFile,
} from '../lib/signatureImage';
import { SignatureBackgroundControls } from './SignatureBackgroundControls';
import { SignatureDropzone } from './SignatureDropzone';

interface Props {
  /** Recebe o PNG já convertido/tratado; `null` quando não há imagem válida. */
  onChange: (blob: Blob | null) => void;
  /** Contador: cada incremento descarta o arquivo escolhido. */
  clearSignal: number;
  disabled?: boolean;
}

/** Evita reprocessar a imagem a cada pixel arrastado no slider. */
const PROCESS_DEBOUNCE_MS = 150;

/** Xadrez do preview: sem asset novo, só gradientes. */
const CHECKERBOARD = {
  backgroundColor: '#fff',
  backgroundImage:
    'linear-gradient(45deg, #e2e8f0 25%, transparent 25%), linear-gradient(-45deg, #e2e8f0 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e2e8f0 75%), linear-gradient(-45deg, transparent 75%, #e2e8f0 75%)',
  backgroundSize: '16px 16px',
  backgroundPosition: '0 0, 0 8px, 8px -8px, -8px 0',
};

// Story 163 — envio de foto/scan da assinatura: converte para PNG, redimensiona e
// remove o fundo claro no cliente. Sem fetch: quem salva é o SignatureDialog.
export function SignatureUploadPad({ onChange, clearSignal, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const [file, setFile] = useState<File | null>(null);
  const [dragging, setDragging] = useState(false);
  const [removeBackground, setRemoveBackground] = useState(true);
  const [threshold, setThreshold] = useState(DEFAULT_BACKGROUND_THRESHOLD);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clearSignal === 0) return;
    setFile(null);
    setError(null);
  }, [clearSignal]);

  useEffect(() => {
    if (!file) {
      onChangeRef.current(null);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(async () => {
      try {
        const image = await decodeImageFile(file);
        const canvas = canvasRef.current;
        if (cancelled || !canvas) return;
        drawSignature(canvas, image, { removeBackground, threshold });
        image.close?.();
        const blob = await canvasToPngBlob(canvas);
        if (cancelled) return;
        setError(null);
        onChangeRef.current(blob);
      } catch {
        if (cancelled) return;
        setError('Não foi possível processar a imagem.');
        onChangeRef.current(null);
      }
    }, PROCESS_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [file, removeBackground, threshold]);

  const handleFiles = (files: FileList | null) => {
    const selected = files?.[0];
    if (!selected) return;
    const message = validateSignatureFile(selected);
    if (message) {
      setError(message);
      return;
    }
    setError(null);
    setFile(selected);
  };

  return (
    <div
      className="space-y-3"
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(event) => {
        event.preventDefault();
        setDragging(false);
        if (!disabled) handleFiles(event.dataTransfer.files);
      }}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg"
        className="sr-only"
        aria-label="Imagem da assinatura"
        disabled={disabled}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = '';
        }}
      />

      {file ? (
        <div
          className="flex h-[180px] items-center justify-center rounded-md border p-2"
          style={CHECKERBOARD}
        >
          <canvas ref={canvasRef} aria-label="Prévia da assinatura" className="max-h-full max-w-full" />
        </div>
      ) : (
        <SignatureDropzone
          dragging={dragging}
          disabled={disabled}
          onClick={() => inputRef.current?.click()}
        />
      )}

      {file && (
        <div className="flex items-center justify-between gap-2">
          <span className="truncate text-xs text-muted-foreground">{file.name}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={disabled}
            onClick={() => inputRef.current?.click()}
          >
            Trocar imagem
          </Button>
        </div>
      )}

      <SignatureBackgroundControls
        enabled={removeBackground}
        onEnabledChange={setRemoveBackground}
        threshold={threshold}
        onThresholdChange={setThreshold}
        disabled={disabled}
      />

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
