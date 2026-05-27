import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ExternalLink, FileText, Image, Mic } from 'lucide-react';
import type { Message } from '@fonte/api-client';
import { MessageStatus } from '@fonte/types';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LoadingState } from '@/components/shared/LoadingState';
import { EmptyState } from '@/components/shared/EmptyState';
import { MessageBubble } from './MessageBubble';
import { useApproveMessage, useRejectMessage } from '../hooks/useMessages';

interface ThreadPanelProps {
  title: string | null;
  messages: Message[];
  isLoading: boolean;
  showModerationActions?: boolean;
  /** Filhos↔Familiares: render chat bubbles */
  chatMode?: boolean;
  /** Unused after senderProfileType migration — kept for compat */
  chatResidentName?: string;
  /** Servos tab: show resident link in header */
  residentLinkId?: string;
  residentLinkName?: string;
}

function formatTime(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function AttachmentIcon({ type, isRight }: { type: string | null; isRight: boolean }) {
  const cls = cn('flex items-center gap-1.5 text-sm', isRight ? 'text-primary-foreground/80' : 'text-muted-foreground');
  if (type === 'image') return <span className={cls}><Image size={14} /> Imagem</span>;
  if (type === 'audio') return <span className={cls}><Mic size={14} /> Áudio</span>;
  if (type === 'document') return <span className={cls}><FileText size={14} /> Documento</span>;
  return null;
}

interface ChatBubbleProps {
  message: Message;
  isRight: boolean;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
  approvingId: string | null;
  rejectingId: string | null;
  prevDate?: string;
}

function ChatBubble({ message, isRight, onApprove, onReject, approvingId, rejectingId, prevDate }: ChatBubbleProps) {
  const isPending = message.status === MessageStatus.PENDING_APPROVAL;
  const isRejected = message.status === MessageStatus.REJECTED;
  const isBusy = approvingId === message.id || rejectingId === message.id;
  const msgDate = formatDate(message.createdAt);
  const showDateDivider = prevDate !== msgDate;

  return (
    <>
      {showDateDivider && (
        <div className="flex items-center gap-3 my-3 px-4">
          <div className="flex-1 h-px bg-border" />
          <span className="text-xs text-muted-foreground shrink-0">{msgDate}</span>
          <div className="flex-1 h-px bg-border" />
        </div>
      )}

      <div className={cn('flex mb-2 px-4', isRight ? 'justify-end' : 'justify-start')}>
        <div className="max-w-[72%]">
          {/* sender name */}
          <p className={cn('text-xs text-muted-foreground mb-0.5', isRight ? 'text-right' : 'text-left')}>
            {message.senderName}
          </p>

          {/* bubble */}
          <div
            className={cn(
              'rounded-2xl px-3 py-2 text-sm',
              isRight
                ? 'bg-primary text-primary-foreground rounded-br-sm'
                : 'bg-muted text-foreground rounded-bl-sm',
              isPending && 'opacity-70',
              isRejected && 'opacity-50',
            )}
          >
            {message.content ? (
              <p className="whitespace-pre-wrap break-words">{message.content}</p>
            ) : (
              <AttachmentIcon type={message.attachmentType} isRight={isRight} />
            )}
          </div>

          {/* meta: status + time */}
          <div className={cn('flex items-center gap-2 mt-0.5', isRight ? 'justify-end' : 'justify-start')}>
            {isPending && (
              <span className="text-xs text-amber-600 dark:text-amber-400 font-medium">Pendente</span>
            )}
            {isRejected && (
              <span className="text-xs text-red-500 dark:text-red-400 font-medium">Rejeitado</span>
            )}
            <span className="text-xs text-muted-foreground">{formatTime(message.createdAt)}</span>
          </div>

          {/* moderation actions */}
          {isPending && onApprove && onReject && (
            <div className={cn('flex items-center gap-1.5 mt-1', isRight ? 'justify-end' : 'justify-start')}>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs text-green-700 border-green-300 hover:bg-green-50 dark:text-green-400 dark:border-green-700 dark:hover:bg-green-950"
                onClick={() => onApprove(message.id)}
                disabled={isBusy}
              >
                {approvingId === message.id ? '…' : 'Aprovar'}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-xs text-red-700 border-red-300 hover:bg-red-50 dark:text-red-400 dark:border-red-700 dark:hover:bg-red-950"
                onClick={() => onReject(message.id)}
                disabled={isBusy}
              >
                {rejectingId === message.id ? '…' : 'Rejeitar'}
              </Button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

export function ThreadPanel({
  title,
  messages,
  isLoading,
  showModerationActions,
  chatMode,
  chatResidentName: _chatResidentName,
  residentLinkId,
  residentLinkName,
}: ThreadPanelProps) {
  const [approvingId, setApprovingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);

  const approve = useApproveMessage();
  const reject = useRejectMessage();

  useEffect(() => {
    if (chatMode) {
      bottomRef.current?.scrollIntoView({ behavior: 'instant' });
    }
  }, [messages, chatMode]);

  const handleApprove = (id: string) => {
    setApprovingId(id);
    approve.mutate(id, { onSettled: () => setApprovingId(null) });
  };

  const handleReject = (id: string) => {
    setRejectingId(id);
    reject.mutate(id, { onSettled: () => setRejectingId(null) });
  };

  if (!title) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <EmptyState title="Selecione uma conversa" />
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b shrink-0">
        <h3 className="text-sm font-semibold">{title}</h3>
        {residentLinkId && residentLinkName && (
          <Link
            to={`/residents/${residentLinkId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-0.5"
          >
            <ExternalLink size={11} />
            {residentLinkName}
          </Link>
        )}
      </div>

      {/* Body */}
      <div className={cn('flex-1 overflow-y-auto', chatMode ? 'py-3' : '')}>
        {isLoading ? (
          <LoadingState />
        ) : messages.length === 0 ? (
          <EmptyState title="Nenhuma mensagem nesta conversa" />
        ) : chatMode ? (
          <>
            {messages.map((msg, i) => {
              const isRight = msg.senderProfileType === 'RESIDENT';
              const prevMsg = messages[i - 1];
              const prevDate = prevMsg ? formatDate(prevMsg.createdAt) : undefined;
              return (
                <ChatBubble
                  key={msg.id}
                  message={msg}
                  isRight={isRight}
                  onApprove={showModerationActions ? handleApprove : undefined}
                  onReject={showModerationActions ? handleReject : undefined}
                  approvingId={approvingId}
                  rejectingId={rejectingId}
                  prevDate={prevDate}
                />
              );
            })}
            <div ref={bottomRef} />
          </>
        ) : (
          messages.map((msg) => (
            <MessageBubble
              key={msg.id}
              message={msg}
              onApprove={showModerationActions ? handleApprove : undefined}
              onReject={showModerationActions ? handleReject : undefined}
              approvingId={approvingId}
              rejectingId={rejectingId}
            />
          ))
        )}
      </div>
    </div>
  );
}
