import { useRef } from 'react';
import { ImageUp } from 'lucide-react';
import type { Event } from '@fonte/api-client';
import { Button } from '@/components/ui/button';
import { getErrorMessage } from '@/lib/errors';
import { useUploadEventBanner } from '../hooks/useEvents';

interface Props {
  event: Event;
}

export function EventBannerUpload({ event }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const mutation = useUploadEventBanner();

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) mutation.mutate({ id: event.id, file });
    e.target.value = '';
  };

  return (
    <div className="space-y-2">
      {event.bannerUrl && (
        <img
          src={event.bannerUrl}
          alt={`Banner de ${event.title}`}
          className="w-full max-h-40 rounded-md object-cover"
        />
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={mutation.isPending}
        onClick={() => inputRef.current?.click()}
      >
        <ImageUp size={14} className="mr-1.5" />
        {mutation.isPending ? 'Enviando...' : event.bannerUrl ? 'Trocar banner' : 'Adicionar banner'}
      </Button>
      {mutation.error != null && (
        <p className="text-xs text-destructive">
          {getErrorMessage(mutation.error, 'Erro ao enviar banner.')}
        </p>
      )}
    </div>
  );
}
