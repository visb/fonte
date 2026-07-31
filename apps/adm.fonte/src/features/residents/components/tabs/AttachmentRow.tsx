import { ExternalLink, Loader2, Paperclip, Trash2 } from 'lucide-react';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';
import { useDeleteAttachment } from '../../hooks/useResidents';
import type { ResidentAttachment } from '@fonte/api-client';

export function AttachmentRow({ attachment }: { attachment: ResidentAttachment }) {
  const deleteMutation = useDeleteAttachment(attachment.residentId);
  const date = new Date(attachment.createdAt).toLocaleDateString('pt-BR');

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <Paperclip size={16} className="text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.filename}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button variant="outline" size="sm" onClick={() => window.open(api.photoUrl(attachment.fileUrl)!, '_blank', 'noreferrer')}>
          <ExternalLink size={14} className="mr-1.5" />
          Abrir
        </Button>
        <Button variant="ghost" size="sm" className="text-destructive hover:text-destructive" disabled={deleteMutation.isPending} onClick={() => deleteMutation.mutate(attachment.id)}>
          {deleteMutation.isPending ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
        </Button>
      </div>
    </div>
  );
}
