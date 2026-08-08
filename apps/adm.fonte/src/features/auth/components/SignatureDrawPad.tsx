import { useEffect, useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';

interface Props {
  /** Recebe o PNG do traço a cada alteração; `null` quando o pad está vazio. */
  onChange: (blob: Blob | null) => void;
  /** Contador: cada incremento limpa o pad (o botão "Limpar" fica no dialog). */
  clearSignal: number;
  disabled?: boolean;
}

// Story 163 — extração do pad de desenho que vivia dentro do SignatureDialog.
// Comportamento idêntico ao da story 128: traço preto, PNG transparente.
export function SignatureDrawPad({ onChange, clearSignal, disabled }: Props) {
  const padRef = useRef<SignatureCanvas | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (clearSignal === 0) return;
    padRef.current?.clear();
    setError(null);
    onChangeRef.current(null);
  }, [clearSignal]);

  const handleEnd = () => {
    const pad = padRef.current;
    if (!pad || pad.isEmpty()) {
      onChangeRef.current(null);
      return;
    }
    // PNG mantém o fundo transparente do traço (story 128, decisão 1).
    pad.getCanvas().toBlob((blob) => {
      if (!blob) {
        setError('Não foi possível gerar a imagem da assinatura.');
        onChangeRef.current(null);
        return;
      }
      setError(null);
      onChangeRef.current(blob);
    }, 'image/png');
  };

  return (
    <div className="space-y-2">
      <div className="rounded-md border bg-white">
        <SignatureCanvas
          ref={padRef}
          penColor="black"
          onEnd={handleEnd}
          canvasProps={{
            'aria-label': 'Área de assinatura',
            className: 'w-full',
            style: { height: 180, pointerEvents: disabled ? 'none' : undefined },
          }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        Desenhe sua assinatura com o mouse ou com o dedo.
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
