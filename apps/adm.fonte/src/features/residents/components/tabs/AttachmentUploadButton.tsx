import { useRef } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAddAttachment } from '../../hooks/useResidents';

export function AttachmentUploadButton({ residentId }: { residentId: string }) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mutation = useAddAttachment(residentId);

  return (
    <>
      <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={() => fileInputRef.current?.click()}>
        {mutation.isPending ? <Loader2 size={14} className="animate-spin mr-1.5" /> : <Upload size={14} className="mr-1.5" />}
        Adicionar anexo
      </Button>
      <input ref={fileInputRef} type="file" className="hidden" onChange={(e) => {
        const file = e.target.files?.[0];
        if (file) mutation.mutate(file);
        e.target.value = '';
      }} />
    </>
  );
}
