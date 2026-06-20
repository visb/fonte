import { useState } from 'react';
import { api } from '@/lib/api';
import { getErrorMessage } from '@/lib/errors';

interface Props {
  eventId: string;
  value: string;
  onChange: (fileKey: string) => void;
}

/**
 * Campo `file` da inscrição (story 68): faz upload imediato ao escolher o
 * arquivo e guarda a fileKey retornada como valor do campo em `answers`.
 */
export function RegistrationFileField({ eventId, value, onChange }: Props) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await api.events.public.uploadRegistrationFile(eventId, fd);
      onChange(res.fileKey);
    } catch (err) {
      setError(getErrorMessage(err, 'Não foi possível enviar o arquivo.'));
      onChange('');
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <input type="file" accept="image/*,application/pdf" onChange={handleChange} disabled={uploading} />
      {uploading && <p className="hint">Enviando arquivo...</p>}
      {value && !uploading && <p className="hint">Arquivo enviado.</p>}
      {error && <p className="error-msg">{error}</p>}
    </div>
  );
}
