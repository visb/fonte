import {
  DEFAULT_BACKGROUND_THRESHOLD,
  MAX_BACKGROUND_THRESHOLD,
  MIN_BACKGROUND_THRESHOLD,
} from '../lib/signatureImage';

interface Props {
  enabled: boolean;
  onEnabledChange: (enabled: boolean) => void;
  threshold: number;
  onThresholdChange: (threshold: number) => void;
  disabled?: boolean;
}

// Story 163 (decisão 4) — a remoção automática erra em assinatura a lápis ou papel
// amarelado; o usuário precisa poder desligar ou ajustar o limiar.
export function SignatureBackgroundControls({
  enabled,
  onEnabledChange,
  threshold,
  onThresholdChange,
  disabled,
}: Props) {
  return (
    <div className="space-y-2">
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          className="h-4 w-4 accent-primary"
          checked={enabled}
          disabled={disabled}
          onChange={(event) => onEnabledChange(event.target.checked)}
        />
        Remover fundo claro
      </label>

      {enabled && (
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground">Sensibilidade</span>
          <input
            type="range"
            className="h-1 flex-1 accent-primary"
            aria-label="Limiar de remoção do fundo"
            min={MIN_BACKGROUND_THRESHOLD}
            max={MAX_BACKGROUND_THRESHOLD}
            step={1}
            value={threshold}
            disabled={disabled}
            onChange={(event) => onThresholdChange(Number(event.target.value))}
          />
          <span className="w-8 text-right text-xs tabular-nums text-muted-foreground">
            {threshold}
          </span>
        </div>
      )}
      {enabled && threshold !== DEFAULT_BACKGROUND_THRESHOLD && (
        <button
          type="button"
          className="text-xs text-muted-foreground underline"
          onClick={() => onThresholdChange(DEFAULT_BACKGROUND_THRESHOLD)}
        >
          Restaurar padrão
        </button>
      )}
    </div>
  );
}
