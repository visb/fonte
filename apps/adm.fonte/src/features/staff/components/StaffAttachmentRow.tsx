import { ExternalLink, Paperclip, Trash2 } from 'lucide-react';
import type { StaffAttachment } from '@fonte/api-client';
import { api } from '@/lib/api';
import { Button } from '@/components/ui/button';

interface Props {
  attachment: StaffAttachment;
  onDelete: (attachment: StaffAttachment) => void;
}

// Item da lista de anexos do servo (story 98): nome, data, abrir e remover.
// A confirmação e a mutation de remoção vivem no StaffAttachmentsTab.
export function StaffAttachmentRow({ attachment, onDelete }: Props) {
  const date = new Date(attachment.createdAt).toLocaleDateString('pt-BR');

  return (
    <div className="flex items-center gap-3 rounded-lg border bg-card px-4 py-3">
      <Paperclip size={16} className="text-muted-foreground shrink-0" />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{attachment.fileName}</p>
        <p className="text-xs text-muted-foreground">{date}</p>
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <Button
          variant="outline"
          size="sm"
          onClick={() => window.open(api.photoUrl(attachment.fileUrl)!, '_blank', 'noreferrer')}
        >
          <ExternalLink size={14} className="mr-1.5" />
          Abrir
        </Button>
        <Button
          variant="ghost"
          size="sm"
          title="Remover anexo"
          className="text-destructive hover:text-destructive"
          onClick={() => onDelete(attachment)}
        >
          <Trash2 size={14} />
        </Button>
      </div>
    </div>
  );
}
