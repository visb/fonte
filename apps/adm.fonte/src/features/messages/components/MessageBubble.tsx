import type { Message } from '@fonte/api-client';
import { MessageStatus } from '@fonte/types';
import { FileText, Image, Mic } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface MessageBubbleProps {
  message: Message;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  approvingId?: string | null;
  rejectingId?: string | null;
}

const statusConfig: Record<string, { label: string; className: string }> = {
  [MessageStatus.APPROVED]: {
    label: 'Aprovado',
    className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
  },
  [MessageStatus.REJECTED]: {
    label: 'Rejeitado',
    className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
  },
  [MessageStatus.PENDING_APPROVAL]: {
    label: 'Pendente',
    className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
  },
};

function formatMessageDate(dateStr: string): string {
  const d = new Date(dateStr);
  const datePart = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' });
  const timePart = d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${datePart} ${timePart}`;
}

function AttachmentPreview({ type }: { type: string | null }) {
  if (type === 'image') return (
    <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
      <Image size={14} /> Imagem
    </span>
  );
  if (type === 'audio') return (
    <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
      <Mic size={14} /> Áudio
    </span>
  );
  if (type === 'document') return (
    <span className="flex items-center gap-1.5 text-muted-foreground text-sm">
      <FileText size={14} /> Documento
    </span>
  );
  return null;
}

export function MessageBubble({
  message,
  onApprove,
  onReject,
  approvingId,
  rejectingId,
}: MessageBubbleProps) {
  const config = statusConfig[message.status] ?? statusConfig[MessageStatus.PENDING_APPROVAL];
  const isPending = message.status === MessageStatus.PENDING_APPROVAL;
  const isModerated =
    message.status === MessageStatus.APPROVED || message.status === MessageStatus.REJECTED;
  const isBusy = approvingId === message.id || rejectingId === message.id;

  return (
    <div className="px-4 py-3 border-b last:border-b-0 flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium">{message.senderName}</span>
        <span className="text-xs text-muted-foreground">{formatMessageDate(message.createdAt)}</span>
      </div>

      <div>
        {message.content ? (
          <p className="text-sm whitespace-pre-wrap">{message.content}</p>
        ) : (
          <AttachmentPreview type={message.attachmentType} />
        )}
      </div>

      <div className="flex items-center gap-2 flex-wrap">
        <span className={cn('inline-flex items-center rounded px-2 py-0.5 text-xs font-medium', config.className)}>
          {config.label}
        </span>

        {isModerated && message.approvedByName && (
          <span className="text-xs text-muted-foreground">por {message.approvedByName}</span>
        )}

        {isPending && onApprove && onReject && (
          <div className="flex items-center gap-1.5 ml-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950"
              onClick={() => onApprove(message.id)}
              disabled={isBusy}
            >
              {approvingId === message.id ? '...' : 'Aprovar'}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-6 px-2 text-xs text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950"
              onClick={() => onReject(message.id)}
              disabled={isBusy}
            >
              {rejectingId === message.id ? '...' : 'Rejeitar'}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
