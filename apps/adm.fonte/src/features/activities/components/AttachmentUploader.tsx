import { useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { ATTACHMENT_ACCEPT, validateAttachment } from '../lib/attachments';

interface Props {
  onUpload: (file: File) => void;
  uploading: boolean;
  error?: unknown;
  label?: string;
}

/**
 * Botão de upload de anexo: abre o seletor de arquivo, valida tipo/tamanho no
 * cliente (UX; o backend revalida) e dispara `onUpload`. Mensagens em pt-BR.
 */
export function AttachmentUploader({
  onUpload,
  uploading,
  error,
  label = 'Adicionar anexo',
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [clientError, setClientError] = useState<string | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ''; // permite reenviar o mesmo arquivo
    if (!file) return;
    const message = validateAttachment(file);
    if (message) {
      setClientError(message);
      return;
    }
    setClientError(null);
    onUpload(file);
  };

  return (
    <div className="space-y-1">
      <input
        ref={inputRef}
        type="file"
        accept={ATTACHMENT_ACCEPT}
        className="hidden"
        onChange={handleChange}
        aria-label={label}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
      >
        {uploading ? 'Enviando...' : label}
      </Button>
      {clientError && <p className="text-xs text-destructive">{clientError}</p>}
      {error != null && (
        <p className="text-xs text-destructive">
          {getErrorMessage(error, 'Erro ao enviar o anexo.')}
        </p>
      )}
    </div>
  );
}
