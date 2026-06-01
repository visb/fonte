import { useRef } from 'react';
import { Paperclip, Upload, X } from 'lucide-react';
import { Select } from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';

export const PAYMENT_METHODS = [
  { value: 'Dinheiro', label: 'Dinheiro' },
  { value: 'PIX', label: 'PIX' },
  { value: 'Crédito', label: 'Cartão de Crédito' },
  { value: 'Débito', label: 'Cartão de Débito' },
];

interface Props {
  method: string;
  onMethodChange: (v: string) => void;
  file: File | null;
  onFileChange: (f: File | null) => void;
}

export function FirstPaymentDetails({ method, onMethodChange, file, onFileChange }: Props) {
  const fileRef = useRef<HTMLInputElement>(null);

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 rounded-lg border bg-muted/30 p-4">
      <FormField label="Forma de pagamento">
        <Select value={method} onChange={(e) => onMethodChange(e.target.value)}>
          <option value="">Selecione...</option>
          {PAYMENT_METHODS.map((m) => (
            <option key={m.value} value={m.value}>{m.label}</option>
          ))}
        </Select>
      </FormField>

      <FormField label="Comprovante (opcional)">
        <input
          ref={fileRef}
          type="file"
          accept="image/*,application/pdf"
          className="hidden"
          onChange={(e) => onFileChange(e.target.files?.[0] ?? null)}
        />
        {file ? (
          <div className="flex items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-2 text-sm">
            <Paperclip size={14} className="shrink-0 text-muted-foreground" />
            <span className="flex-1 truncate text-foreground">{file.name}</span>
            <button
              type="button"
              onClick={() => { onFileChange(null); if (fileRef.current) fileRef.current.value = ''; }}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="flex w-full items-center gap-2 rounded-md border border-dashed border-input bg-transparent px-3 py-2.5 text-sm text-muted-foreground hover:border-ring hover:text-foreground transition-colors"
          >
            <Upload size={14} className="shrink-0" />
            <span>Clique para anexar arquivo</span>
          </button>
        )}
      </FormField>
    </div>
  );
}
